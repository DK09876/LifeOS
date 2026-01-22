/**
 * Google Drive Sync Service
 *
 * Syncs local SQLite database with a JSON file in Google Drive
 */

import * as Google from 'expo-auth-session/providers/google';
import * as FileSystem from 'expo-file-system';
import { prisma } from './prisma';

const SYNC_FILE_NAME = 'lifeos-data.json';
const POLL_INTERVAL = 30000; // 30 seconds

interface SyncData {
  lastModified: string;
  version: number;
  tasks: Task[];
  domains: Domain[];
}

class GoogleDriveSyncService {
  private accessToken: string | null = null;
  private fileId: string | null = null;
  private lastSyncTime: Date | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize and authenticate with Google Drive
   */
  async initialize() {
    // Use expo-auth-session for Google OAuth
    const [request, response, promptAsync] = Google.useAuthRequest({
      clientId: 'YOUR_GOOGLE_CLIENT_ID',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    if (response?.type === 'success') {
      this.accessToken = response.authentication?.accessToken || null;
      await this.findOrCreateSyncFile();
      this.startPolling();
    }
  }

  /**
   * Find existing sync file or create new one
   */
  private async findOrCreateSyncFile() {
    // Search for existing file
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${SYNC_FILE_NAME}'&spaces=appDataFolder`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      this.fileId = data.files[0].id;
    } else {
      // Create new file
      await this.createSyncFile();
    }
  }

  /**
   * Create new sync file in Google Drive
   */
  private async createSyncFile() {
    const metadata = {
      name: SYNC_FILE_NAME,
      mimeType: 'application/json',
      parents: ['appDataFolder'], // Hidden from user
    };

    const initialData: SyncData = {
      lastModified: new Date().toISOString(),
      version: 1,
      tasks: [],
      domains: [],
    };

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'multipart/related; boundary=boundary',
        },
        body: this.createMultipartBody(metadata, initialData),
      }
    );

    const data = await response.json();
    this.fileId = data.id;
  }

  /**
   * Start polling for changes
   */
  startPolling() {
    if (this.syncInterval) return;

    // Initial sync
    this.sync();

    // Poll every 30 seconds
    this.syncInterval = setInterval(() => {
      this.sync();
    }, POLL_INTERVAL);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Main sync logic
   */
  async sync() {
    try {
      // 1. Check if remote file has been modified
      const remoteModifiedTime = await this.getRemoteModifiedTime();

      if (this.shouldDownload(remoteModifiedTime)) {
        // 2. Download remote data
        const remoteData = await this.downloadFromDrive();

        // 3. Merge with local data
        await this.mergeRemoteData(remoteData);

        this.lastSyncTime = new Date(remoteModifiedTime);
      }

      // 4. Check if we have local changes to upload
      if (await this.hasLocalChanges()) {
        await this.uploadToDrive();
      }

      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }

  /**
   * Get remote file modified time
   */
  private async getRemoteModifiedTime(): Promise<string> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${this.fileId}?fields=modifiedTime`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    const data = await response.json();
    return data.modifiedTime;
  }

  /**
   * Should we download remote changes?
   */
  private shouldDownload(remoteModifiedTime: string): boolean {
    if (!this.lastSyncTime) return true;
    return new Date(remoteModifiedTime) > this.lastSyncTime;
  }

  /**
   * Download data from Google Drive
   */
  private async downloadFromDrive(): Promise<SyncData> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    return await response.json();
  }

  /**
   * Merge remote data with local database
   * Uses "last write wins" strategy
   */
  private async mergeRemoteData(remoteData: SyncData) {
    // Merge tasks
    for (const remoteTask of remoteData.tasks) {
      const localTask = await prisma.task.findUnique({
        where: { id: remoteTask.id },
      });

      if (!localTask) {
        // New task from remote
        await prisma.task.create({ data: remoteTask });
      } else if (new Date(remoteTask.updatedAt) > new Date(localTask.updatedAt)) {
        // Remote is newer, update local
        await prisma.task.update({
          where: { id: remoteTask.id },
          data: remoteTask,
        });
      }
    }

    // Merge domains (same logic)
    for (const remoteDomain of remoteData.domains) {
      const localDomain = await prisma.domain.findUnique({
        where: { id: remoteDomain.id },
      });

      if (!localDomain) {
        await prisma.domain.create({ data: remoteDomain });
      } else if (new Date(remoteDomain.updatedAt) > new Date(localDomain.updatedAt)) {
        await prisma.domain.update({
          where: { id: remoteDomain.id },
          data: remoteDomain,
        });
      }
    }
  }

  /**
   * Check if we have local changes to sync
   */
  private async hasLocalChanges(): Promise<boolean> {
    if (!this.lastSyncTime) return true;

    const recentTasks = await prisma.task.count({
      where: {
        updatedAt: {
          gt: this.lastSyncTime,
        },
      },
    });

    const recentDomains = await prisma.domain.count({
      where: {
        updatedAt: {
          gt: this.lastSyncTime,
        },
      },
    });

    return recentTasks > 0 || recentDomains > 0;
  }

  /**
   * Upload local data to Google Drive
   */
  private async uploadToDrive() {
    // Get all local data
    const tasks = await prisma.task.findMany();
    const domains = await prisma.domain.findMany();

    const syncData: SyncData = {
      lastModified: new Date().toISOString(),
      version: Date.now(),
      tasks,
      domains,
    };

    // Update file in Google Drive
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncData),
      }
    );

    this.lastSyncTime = new Date();
  }

  /**
   * Helper to create multipart body for file upload
   */
  private createMultipartBody(metadata: any, content: any): string {
    const boundary = 'boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(content) +
      closeDelimiter;

    return multipartBody;
  }

  /**
   * Manual sync trigger
   */
  async forceSyncNow() {
    await this.sync();
  }
}

export const googleDriveSync = new GoogleDriveSyncService();
