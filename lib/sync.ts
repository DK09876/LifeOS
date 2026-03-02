// Google Drive sync service
// Syncs local IndexedDB data with a JSON file in user's Google Drive

import { getStoredAuth, refreshTokenIfNeeded } from './google-auth';
import { exportAllData, replaceAllData, hasUnsavedChanges, compactTombstones, getSyncMetadata, updateSyncMetadata, SyncPayload, Task, Domain, Habit } from './db';

const DRIVE_FILE_NAME = 'lifeos-data.json';
const DRIVE_FOLDER_NAME = 'LifeOS';

let syncInProgress = false;

export interface SyncResult {
  success: boolean;
  message: string;
  lastSyncedAt?: string;
}

// Get or create the LifeOS folder in Google Drive
async function getOrCreateFolder(accessToken: string): Promise<string> {
  // Search for existing folder
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error('Failed to search for folder');
  }

  const searchResult = await searchResponse.json();

  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) {
    throw new Error('Failed to create folder');
  }

  const createResult = await createResponse.json();
  return createResult.id;
}

// Find the data file in Google Drive
async function findDataFile(accessToken: string, folderId: string): Promise<string | null> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search for data file');
  }

  const result = await response.json();

  if (result.files && result.files.length > 0) {
    return result.files[0].id;
  }

  return null;
}

// Download data from Google Drive
async function downloadData(accessToken: string, fileId: string): Promise<SyncPayload | { tasks: Task[]; domains: Domain[]; habits?: Habit[]; exportedAt: string } | null> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to download data');
  }

  return response.json();
}

// Upload data to Google Drive
async function uploadData(
  accessToken: string,
  folderId: string,
  fileId: string | null,
  data: SyncPayload
): Promise<string> {
  const metadata = {
    name: DRIVE_FILE_NAME,
    mimeType: 'application/json',
    ...(fileId ? {} : { parents: [folderId] }),
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const response = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error('Failed to upload data');
  }

  const result = await response.json();
  return result.id;
}

// Push local data to Google Drive (overwrites remote)
export async function pushToGoogleDrive(): Promise<SyncResult> {
  if (syncInProgress) {
    return { success: false, message: 'Sync already in progress' };
  }
  syncInProgress = true;
  try {
    const user = await refreshTokenIfNeeded();
    if (!user) {
      return {
        success: false,
        message: 'Not signed in to Google. Please sign in to sync.',
      };
    }

    const accessToken = user.accessToken;
    const folderId = await getOrCreateFolder(accessToken);
    const fileId = await findDataFile(accessToken, folderId);

    // Compact old tombstones before pushing
    await compactTombstones();

    const localData = await exportAllData();
    const newFileId = await uploadData(accessToken, folderId, fileId, localData);

    const now = new Date().toISOString();
    await updateSyncMetadata({
      lastSyncedAt: now,
      googleDriveFileId: newFileId,
      userEmail: user.email,
    });

    return {
      success: true,
      message: 'Data pushed to Google Drive',
      lastSyncedAt: now,
    };
  } catch (error) {
    console.error('Push error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Push failed',
    };
  } finally {
    syncInProgress = false;
  }
}

// Pull from Google Drive (full replace local)
export async function pullFromGoogleDrive(): Promise<SyncResult> {
  if (syncInProgress) {
    return { success: false, message: 'Sync already in progress' };
  }
  syncInProgress = true;
  try {
    const user = await refreshTokenIfNeeded();
    if (!user) {
      return {
        success: false,
        message: 'Not signed in to Google. Please sign in to sync.',
      };
    }

    const accessToken = user.accessToken;
    const folderId = await getOrCreateFolder(accessToken);
    const fileId = await findDataFile(accessToken, folderId);

    if (!fileId) {
      return {
        success: false,
        message: 'No data found in Google Drive',
      };
    }

    const remoteData = await downloadData(accessToken, fileId);
    if (!remoteData) {
      return {
        success: false,
        message: 'Failed to download data from Google Drive',
      };
    }

    // Full replace local data with remote
    await replaceAllData(remoteData);

    const now = new Date().toISOString();
    await updateSyncMetadata({
      lastSyncedAt: now,
      googleDriveFileId: fileId,
      userEmail: user.email,
    });

    return {
      success: true,
      message: 'Data pulled from Google Drive',
      lastSyncedAt: now,
    };
  } catch (error) {
    console.error('Pull error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Pull failed',
    };
  } finally {
    syncInProgress = false;
  }
}

// Re-export hasUnsavedChanges for use in components
export { hasUnsavedChanges } from './db';

// Check sync status
export async function getSyncStatus(): Promise<{
  isSignedIn: boolean;
  userEmail: string | null;
  lastSyncedAt: string | null;
}> {
  const user = getStoredAuth();
  const metadata = await getSyncMetadata();

  return {
    isSignedIn: !!user,
    userEmail: user?.email || metadata?.userEmail || null,
    lastSyncedAt: metadata?.lastSyncedAt || null,
  };
}
