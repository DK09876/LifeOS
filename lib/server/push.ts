/**
 * Web Push from the Pi.
 *
 * No third-party notification service: the browser vendors' push relays
 * (Apple's, Google's, Mozilla's) deliver an encrypted message signed with
 * keys generated here, on first use, and kept in the server's own database.
 * The relay sees only ciphertext.
 */

import webpush from 'web-push';

import {
  deletePushSubscription, getPreferences, listPushSubscriptions, setPreference,
} from './store';

const SYSTEM = '_system';

let configured = false;

export function vapidPublicKey(): string {
  ensureKeys();
  return getPreferences(SYSTEM)['vapid.public'];
}

function ensureKeys() {
  if (configured) return;
  const prefs = getPreferences(SYSTEM);
  let publicKey = prefs['vapid.public'];
  let privateKey = prefs['vapid.private'];
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    setPreference(SYSTEM, 'vapid.public', publicKey);
    setPreference(SYSTEM, 'vapid.private', privateKey);
  }
  // The subject identifies the sender to the push service. Apple refuses
  // anything that is not a real https: URL or mailto: address - the original
  // 'mailto:lifeos@localhost' got every push rejected with a 403 - so it is
  // the app's own address.
  webpush.setVapidDetails(process.env.LIFEOS_PUSH_SUBJECT || 'https://pai.tail57458f.ts.net', publicKey, privateKey);
  configured = true;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Send to every device the profile has subscribed. A device that has gone
 * away (404/410 from its push service) is forgotten rather than retried.
 */
export interface PushResult { sent: number; failed: number; reason?: string }

/** The last delivery attempt for a profile, shown in Settings. */
export const PUSH_RESULT_PREF = 'push.lastResult';

export async function pushToProfile(userId: string, message: PushMessage): Promise<PushResult> {
  ensureKeys();
  let sent = 0;
  let failed = 0;
  let reason: string | undefined;
  for (const row of listPushSubscriptions(userId)) {
    try {
      await webpush.sendNotification(JSON.parse(row.data), JSON.stringify(message), { TTL: 60 * 60 * 6 });
      sent++;
    } catch (error) {
      failed++;
      const err = error as { statusCode?: number; body?: string; message?: string };
      if (err.statusCode === 404 || err.statusCode === 410) {
        deletePushSubscription(userId, row.endpoint);
        reason = 'device no longer subscribed — turn notifications on again';
      } else {
        // The push service's own explanation lives in the body; without it a
        // bare 403 said nothing about why.
        reason = `${err.statusCode ?? 'error'} ${(err.body || err.message || '').trim()}`.slice(0, 300);
        console.error('[push] send failed', reason);
      }
    }
  }
  if (sent || failed) {
    setPreference(userId, PUSH_RESULT_PREF, JSON.stringify({
      at: new Date().toISOString(), sent, failed, reason: failed ? reason : undefined, title: message.title,
    }));
  }
  return { sent, failed, reason };
}
