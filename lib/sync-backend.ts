/**
 * Chooses where LifeOS syncs. IndexedDB is always the local working copy;
 * this decides what, if anything, it syncs against.
 *
 *   server - a self-hosted LifeOS server (default)
 *   drive  - Google Drive, the original backend
 *   local  - no sync, this device only
 */

'use client';

import { pushToGoogleDrive, pullFromGoogleDrive, type SyncResult } from './sync';
import { pushToServer, pullFromServer } from './sync-server';

export type SyncBackend = 'server' | 'drive' | 'local';

const BACKEND_KEY = 'lifeos-sync-backend';
const DEFAULT_BACKEND: SyncBackend = 'server';

export function getSyncBackend(): SyncBackend {
  if (typeof window === 'undefined') return DEFAULT_BACKEND;
  const stored = localStorage.getItem(BACKEND_KEY);
  return stored === 'drive' || stored === 'local' || stored === 'server'
    ? stored
    : DEFAULT_BACKEND;
}

export function setSyncBackend(backend: SyncBackend) {
  localStorage.setItem(BACKEND_KEY, backend);
}

const LOCAL_ONLY: SyncResult = {
  success: false,
  message: 'Sync is off. Enable a backend in Settings.',
};

export async function push(): Promise<SyncResult> {
  switch (getSyncBackend()) {
    case 'server':
      return pushToServer();
    case 'drive':
      return pushToGoogleDrive();
    default:
      return LOCAL_ONLY;
  }
}

export async function pull(): Promise<SyncResult> {
  switch (getSyncBackend()) {
    case 'server':
      return pullFromServer();
    case 'drive':
      return pullFromGoogleDrive();
    default:
      return LOCAL_ONLY;
  }
}

export function syncBackendLabel(backend = getSyncBackend()): string {
  return backend === 'server'
    ? 'Self-hosted server'
    : backend === 'drive'
      ? 'Google Drive'
      : 'This device only';
}
