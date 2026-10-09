/**
 * Siri's way in: free text to pantry, pantry's spoken reply back.
 *
 *   POST { "text": "add dishes to today", "device": "iphone" } -> { reply }
 *
 * The iOS Shortcut talks to this over the tailnet with the app's HTTPS
 * address; it forwards to pantry's local listener on the Pi, which runs the
 * language model and calls /api/assistant.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PANTRY_URL = process.env.PANTRY_URL || 'http://127.0.0.1:8790/ask';

export async function POST(request: Request) {
  let body: { text?: string; device?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reply: "I didn't get that." }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ reply: "I didn't hear anything." });
  try {
    const response = await fetch(PANTRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, device: body.device || 'siri' }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await response.json()) as { reply?: string };
    return NextResponse.json({ reply: data.reply || 'Done.' });
  } catch (error) {
    console.error('[voice] pantry unreachable', (error as Error).message);
    return NextResponse.json({ reply: "Pantry isn't answering right now." });
  }
}
