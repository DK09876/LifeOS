/**
 * Whether a poll counts as a change.
 *
 * The server stamps every read with the time it was read, so comparing whole
 * bodies found a difference every single time. That defeated the check and
 * re-rendered the entire app twice a second — which on a phone took focus off
 * whatever field you were typing in and dropped the keyboard with it.
 */

import { describe, expect, it } from 'vitest';

// Mirrors the comparison in lib/store.ts. Kept here as a unit because the
// store itself only runs in a browser with a live profile.
const withoutReadTime = (body: string) => body.replace(/,?"exportedAt":"[^"]*"/, '');
const unchanged = (a: string, b: string) => withoutReadTime(a) === withoutReadTime(b);

const payload = (tasks: string, at: string) =>
  `{"tasks":[${tasks}],"domains":[],"exportedAt":"${at}"}`;

describe('poll comparison', () => {
  // The bug, stated directly.
  it('treats two reads of identical data as unchanged', () => {
    const a = payload('{"id":"t1"}', '2026-09-18T10:00:00.000Z');
    const b = payload('{"id":"t1"}', '2026-09-18T10:00:02.000Z');
    expect(a).not.toBe(b);
    expect(unchanged(a, b)).toBe(true);
  });

  it('still notices real changes', () => {
    const a = payload('{"id":"t1"}', '2026-09-18T10:00:00.000Z');
    const b = payload('{"id":"t1"},{"id":"t2"}', '2026-09-18T10:00:00.000Z');
    expect(unchanged(a, b)).toBe(false);
  });

  it('notices a change even when the read time also moved', () => {
    const a = payload('{"id":"t1"}', '2026-09-18T10:00:00.000Z');
    const b = payload('{"id":"t9"}', '2026-09-18T10:00:02.000Z');
    expect(unchanged(a, b)).toBe(false);
  });

  it('copes with a body that has no timestamp at all', () => {
    expect(unchanged('{"tasks":[]}', '{"tasks":[]}')).toBe(true);
    expect(unchanged('{"tasks":[]}', '{"tasks":[{"id":"x"}]}')).toBe(false);
  });

  // A task whose own text mentions the field must not be mangled into a
  // false match.
  it('does not strip anything but the payload-level field', () => {
    const a = '{"tasks":[{"notes":"check exportedAt"}],"exportedAt":"A"}';
    const b = '{"tasks":[{"notes":"check exportedAt"}],"exportedAt":"B"}';
    expect(unchanged(a, b)).toBe(true);
    const c = '{"tasks":[{"notes":"something else"}],"exportedAt":"B"}';
    expect(unchanged(a, c)).toBe(false);
  });
});
