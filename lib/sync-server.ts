/**
 * Sync against a self-hosted LifeOS server, mirroring the Google Drive
 * functions in sync.ts so either can back the same UI.
 *
 * Unlike Drive, the server merges per record and returns the merged result,
 * so a push also acts as a pull.
 */

'use client';

import {
  exportAllData,
  replaceAllData,
  updateSyncMetadata,
  type SyncPayload,
} from './db';
import type { SyncResult } from './sync';

const SERVER_URL_KEY = 'lifeos-server-url';
const SERVER_TOKEN_KEY = 'lifeos-server-token';

export function getServerConfig(): { url: string; token: string } {
  if (typeof window === 'undefined') return { url: '', token: '' };
  return {
    url: (localStorage.getItem(SERVER_URL_KEY) ?? '').replace(/\/+$/, ''),
    token: localStorage.getItem(SERVER_TOKEN_KEY) ?? '',
  };
}

export function setServerConfig(url: string, token: string) {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ''));
  localStorage.setItem(SERVER_TOKEN_KEY, token);
}

function endpoint(url: string) {
  // An empty URL means "the server that served this page", which is the
  // normal case when LifeOS is hosted on the Pi.
  return `${url}/api/sync`;
}

async function request(method: 'GET' | 'POST', body?: unknown): Promise<Response> {
  const { url, token } = getServerConfig();
  if (!token) throw new Error('No server token set. Add one in Settings.');
  return fetch(endpoint(url), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
}

async function failure(response: Response): Promise<string> {
  if (response.status === 401) return 'Server rejected the token. Check Settings.';
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function pushToServer(): Promise<SyncResult> {
  try {
    const local = await exportAllData();
    const response = await request('POST', local);
    if (!response.ok) return { success: false, message: await failure(response) };

    const merged = (await response.json()) as SyncPayload;
    // The server may hold newer records from another device; adopt its view.
    await replaceAllData({ ...local, ...merged });
    await updateSyncMetadata({ lastSyncedAt: new Date().toISOString() });
    return { success: true, message: 'Synced to server' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

export async function pullFromServer(): Promise<SyncResult> {
  try {
    const response = await request('GET');
    if (!response.ok) return { success: false, message: await failure(response) };

    const remote = (await response.json()) as SyncPayload;
    await replaceAllData(remote);
    await updateSyncMetadata({ lastSyncedAt: new Date().toISOString() });
    return { success: true, message: 'Pulled from server' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Pull failed',
    };
  }
}

export async function serverReachable(): Promise<boolean> {
  try {
    const response = await request('GET');
    return response.ok;
  } catch {
    return false;
  }
}
