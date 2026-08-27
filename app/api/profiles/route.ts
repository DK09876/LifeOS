/**
 * The list of profiles the app can switch between.
 *
 * Deliberately unauthenticated and name-only: this is a household server on
 * a private network, and the switcher needs the list before anyone has
 * chosen who they are. No tokens or data are exposed here.
 */

import { NextResponse } from 'next/server';

import { listUsers } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ profiles: listUsers() });
  } catch (error) {
    console.error('[profiles] list failed', error);
    return NextResponse.json({ error: 'read failed' }, { status: 500 });
  }
}
