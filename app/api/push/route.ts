/**
 * Push notification subscriptions for a profile.
 *
 *   GET  ?profile=dk                      the public key, and how many devices are subscribed
 *   POST ?profile=dk {action: 'subscribe', subscription, label}
 *   POST ?profile=dk {action: 'unsubscribe', endpoint}
 *   POST ?profile=dk {action: 'test'}      push a test to every device
 */

import { NextResponse } from 'next/server';

import { deletePushSubscription, listPushSubscriptions, savePushSubscription } from '@/lib/server/store';
import { pushToProfile, vapidPublicKey } from '@/lib/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function profileOf(request: Request): string | null {
  const profile = new URL(request.url).searchParams.get('profile');
  return profile && profile.trim() ? profile.trim() : null;
}

export async function GET(request: Request) {
  const profile = profileOf(request);
  if (!profile) return NextResponse.json({ error: 'profile required' }, { status: 400 });
  try {
    const devices = listPushSubscriptions(profile).map((row) => ({ endpoint: row.endpoint, label: row.label }));
    return NextResponse.json({ publicKey: vapidPublicKey(), devices });
  } catch (error) {
    console.error('[push] read failed', error);
    return NextResponse.json({ error: 'read failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const profile = profileOf(request);
  if (!profile) return NextResponse.json({ error: 'profile required' }, { status: 400 });

  let body: { action?: string; subscription?: { endpoint?: string }; endpoint?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    if (body.action === 'subscribe') {
      const endpoint = body.subscription?.endpoint;
      if (!endpoint) return NextResponse.json({ error: 'subscription required' }, { status: 400 });
      savePushSubscription(profile, endpoint, JSON.stringify(body.subscription), body.label ?? null);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'unsubscribe') {
      if (!body.endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
      deletePushSubscription(profile, body.endpoint);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'test') {
      const result = await pushToProfile(profile, {
        title: 'LifeOS', body: 'Notifications are working on this device.', url: '/', tag: `test:${Date.now()}`,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[push] write failed', error);
    return NextResponse.json({ error: 'write failed' }, { status: 500 });
  }
}
