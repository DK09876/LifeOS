/**
 * The voice assistant's door into LifeOS.
 *
 *   POST ?profile=dk  { "intent": "complete", "args": { "name": "laundry" } }
 *   -> { ok, say, data? }
 *
 * `say` is one or two short sentences written to be spoken. See
 * lib/server/assistant.ts for the intents. Same trust model as /api/data:
 * reachable only over the tailnet.
 */

import { NextResponse } from 'next/server';

import { ASSISTANT_INTENTS, runAssistant } from '@/lib/server/assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ intents: ASSISTANT_INTENTS });
}

export async function POST(request: Request) {
  const profile = new URL(request.url).searchParams.get('profile')?.trim();
  if (!profile) return NextResponse.json({ ok: false, say: 'No profile given.' }, { status: 400 });
  let body: { intent?: string; args?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, say: 'That request was not readable.' }, { status: 400 });
  }
  if (!body.intent) return NextResponse.json({ ok: false, say: 'No intent given.' }, { status: 400 });
  return NextResponse.json(await runAssistant(profile, body.intent, body.args ?? {}));
}
