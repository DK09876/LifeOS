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
  // The subject is how a push service would contact the sender about abuse;
  // it is never shown to anyone.
  webpush.setVapidDetails('mailto:lifeos@localhost', publicKey, privateKey);
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
export async function pushToProfile(userId: string, message: PushMessage): Promise<{ sent: number; failed: number }> {
  ensureKeys();
  let sent = 0;
  let failed = 0;
  for (const row of listPushSubscriptions(userId)) {
    try {
      await webpush.sendNotification(JSON.parse(row.data), JSON.stringify(message), { TTL: 60 * 60 * 6 });
      sent++;
    } catch (error) {
      failed++;
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) deletePushSubscription(userId, row.endpoint);
      else console.error('[push] send failed', status, (error as Error).message);
    }
  }
  return { sent, failed };
}
