/**
 * Read and write one profile's data.
 *
 *   GET    ?profile=dk                     everything for that profile
 *   POST   ?profile=dk  {collection,records}  upsert records
 *   DELETE ?profile=dk&collection=&id=     remove one record
 *
 * There is deliberately no query language. The dataset is a few hundred rows,
 * so the client holds a collection in memory and filters it in JavaScript -
 * which is what the app already did against IndexedDB.
 */

import { NextResponse } from 'next/server';

import {
  COLLECTIONS,
  clearAllForUser,
  clearCollection,
  replaceAllForUser,
  deleteRecord,
  putRecords,
  readPayload,
  setPreference,
  type Collection,
  type StoredRecord,
} from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function profileOf(request: Request): string | null {
  const profile = new URL(request.url).searchParams.get('profile');
  return profile && profile.trim() ? profile.trim() : null;
}

function isCollection(value: unknown): value is Collection {
  return typeof value === 'string' && (COLLECTIONS as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const profile = profileOf(request);
  if (!profile) return NextResponse.json({ error: 'profile required' }, { status: 400 });
  try {
    return NextResponse.json(readPayload(profile));
  } catch (error) {
    console.error('[data] read failed', error);
    return NextResponse.json({ error: 'read failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const profile = profileOf(request);
  if (!profile) return NextResponse.json({ error: 'profile required' }, { status: 400 });

  let body: {
    collection?: string;
    records?: StoredRecord[];
    preferences?: Record<string, string>;
    clear?: boolean;
    clearAll?: boolean;
    replaceAll?: Partial<Record<Collection, StoredRecord[]>>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    // Wipes everything for the profile atomically; see clearAllForUser.
    if (body.clearAll) {
      clearAllForUser(profile);
      return NextResponse.json({ ok: true });
    }
    // Import: old data is only dropped once the new data commits with it.
    if (body.replaceAll) {
      replaceAllForUser(profile, body.replaceAll);
      return NextResponse.json({ ok: true });
    }
    if (body.preferences) {
      for (const [key, value] of Object.entries(body.preferences)) {
        setPreference(profile, key, value);
      }
    }
    if (body.collection) {
      if (!isCollection(body.collection)) {
        return NextResponse.json({ error: 'unknown collection' }, { status: 400 });
      }
      if (body.clear) clearCollection(profile, body.collection);
      if (body.records?.length) putRecords(profile, body.collection, body.records);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[data] write failed', error);
    return NextResponse.json({ error: 'write failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const profile = profileOf(request);
  const params = new URL(request.url).searchParams;
  const collection = params.get('collection');
  const id = params.get('id');
  if (!profile || !collection || !id) {
    return NextResponse.json({ error: 'profile, collection and id required' }, { status: 400 });
  }
  if (!isCollection(collection)) {
    return NextResponse.json({ error: 'unknown collection' }, { status: 400 });
  }
  try {
    deleteRecord(profile, collection, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[data] delete failed', error);
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
