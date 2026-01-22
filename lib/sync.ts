// Google Drive sync service
// Syncs local IndexedDB data with a JSON file in user's Google Drive

import { getStoredAuth, refreshTokenIfNeeded } from './google-auth';
import { exportAllData, importData, getSyncMetadata, updateSyncMetadata, Task, Domain } from './db';

const DRIVE_FILE_NAME = 'lifeos-data.json';
const DRIVE_FOLDER_NAME = 'LifeOS';

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
async function downloadData(accessToken: string, fileId: string): Promise<{ tasks: Task[]; domains: Domain[]; exportedAt: string } | null> {
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
  data: { tasks: Task[]; domains: Domain[]; exportedAt: string }
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

// Main sync function
export async function syncWithGoogleDrive(): Promise<SyncResult> {
  try {
    // Check if user is authenticated
    const user = await refreshTokenIfNeeded();
    if (!user) {
      return {
        success: false,
        message: 'Not signed in to Google. Please sign in to sync.',
      };
    }

    const accessToken = user.accessToken;

    // Get or create the LifeOS folder
    const folderId = await getOrCreateFolder(accessToken);

    // Find existing data file
    let fileId = await findDataFile(accessToken, folderId);

    // Get local data
    const localData = await exportAllData();

    // Get remote data if file exists
    let remoteData: { tasks: Task[]; domains: Domain[]; exportedAt: string } | null = null;
    if (fileId) {
      remoteData = await downloadData(accessToken, fileId);
    }

    // Merge strategy: Last write wins based on updatedAt
    if (remoteData) {
      // Import remote data (merges based on timestamps)
      await importData(remoteData);

      // Re-export to get merged data
      const mergedData = await exportAllData();

      // Upload merged data
      fileId = await uploadData(accessToken, folderId, fileId, mergedData);
    } else {
      // No remote data, upload local data
      fileId = await uploadData(accessToken, folderId, null, localData);
    }

    // Update sync metadata
    const now = new Date().toISOString();
    await updateSyncMetadata({
      lastSyncedAt: now,
      googleDriveFileId: fileId,
      userEmail: user.email,
    });

    return {
      success: true,
      message: 'Sync completed successfully',
      lastSyncedAt: now,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

// Force push local data to Google Drive (overwrites remote)
export async function pushToGoogleDrive(): Promise<SyncResult> {
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
  }
}

// Force pull from Google Drive (overwrites local)
export async function pullFromGoogleDrive(): Promise<SyncResult> {
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

    // Import remote data (will overwrite local based on timestamps)
    await importData(remoteData);

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
  }
}

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
