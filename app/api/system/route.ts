/**
 * Settings that belong to the installation rather than to a person.
 *
 * Stored against a reserved '_system' row in the preferences table so both
 * profiles see the same value - the off-device backup reminder is about the
 * Pi, not about whoever happens to be looking at it.
 */

import { NextResponse } from 'next/server';

import { getPreferences, setPreference } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = '_system';
const BACKUP_CONFIRMED = 'backup.lastConfirmedAt';

export async function GET() {
  try {
    const values = getPreferences(SYSTEM);
    return NextResponse.json({ backupLastConfirmedAt: values[BACKUP_CONFIRMED] ?? null });
  } catch (error) {
    console.error('[system] read failed', error);
    return NextResponse.json({ error: 'read failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { confirmBackup?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  try {
    if (body.confirmBackup) {
      const now = new Date().toISOString();
      setPreference(SYSTEM, BACKUP_CONFIRMED, now);
      return NextResponse.json({ backupLastConfirmedAt: now });
    }
    return NextResponse.json({ error: 'nothing to do' }, { status: 400 });
  } catch (error) {
    console.error('[system] write failed', error);
    return NextResponse.json({ error: 'write failed' }, { status: 500 });
  }
}
