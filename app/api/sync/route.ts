/**
 * Sync endpoint. GET pulls the caller's dataset, POST merges an upload.
 *
 * Authenticated by a per-user bearer token. This is a home-network service
 * reached over Tailscale, so a shared secret per user is proportionate; it
 * exists to keep two accounts apart, not to withstand attack.
 */

import { NextResponse } from 'next/server';

import { mergePayload, readPayload, userForToken, type Payload } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authenticate(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return userForToken(token);
}

export async function GET(request: Request) {
  const user = authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ user: { id: user.id, name: user.name }, ...readPayload(user.id) });
  } catch (error) {
    console.error('[sync] pull failed', error);
    return NextResponse.json({ error: 'read failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const { applied } = mergePayload(user.id, payload);
    // Return the merged state so the client converges on the server's view
    // rather than assuming its own upload won.
    return NextResponse.json({ applied, ...readPayload(user.id) });
  } catch (error) {
    console.error('[sync] push failed', error);
    return NextResponse.json({ error: 'write failed' }, { status: 500 });
  }
}
