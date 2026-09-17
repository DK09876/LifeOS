/**
 * Import replaces the whole profile, so parseBackup is the only thing
 * standing between a mistyped file picker and the data it was meant to
 * protect. It should refuse loudly rather than import half of something.
 */

import { describe, expect, it } from 'vitest';

import { BACKUP_VERSION, backupFilename, buildBackup, parseBackup } from './backup-file';

const payload = {
  tasks: [{ id: 't1' }, { id: 't2' }],
  domains: [{ id: 'd1' }],
  habits: [], events: [], projects: [], filterPresets: [],
  preferences: { 'suggest.settings': '{}' },
  exportedAt: 'ignored',
};

describe('buildBackup', () => {
  it('captures every collection and the preferences', () => {
    const b = buildBackup('dk', payload);
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.profile).toBe('dk');
    expect(b.collections.tasks).toHaveLength(2);
    expect(b.preferences).toEqual({ 'suggest.settings': '{}' });
  });

  it('round-trips through parseBackup', () => {
    const parsed = parseBackup(JSON.stringify(buildBackup('dk', payload)));
    expect(parsed.counts.tasks).toBe(2);
    expect(parsed.collections.domains).toHaveLength(1);
  });
});

describe('backupFilename', () => {
  it('names the file so it sorts by date and says whose it is', () => {
    expect(backupFilename('dk', new Date(2026, 8, 17, 9, 5)))
      .toBe('lifeos-dk-20260917-0905.json');
  });
});

describe('parseBackup rejects', () => {
  const rejects = (text: string, match: RegExp) => expect(() => parseBackup(text)).toThrow(match);

  it('anything that is not JSON', () => rejects('nope', /not valid JSON/));
  it('JSON that is not an object', () => rejects('[1,2]', /not a LifeOS backup/));
  it('an object with no version', () => rejects('{"collections":{}}', /not a LifeOS backup/));
  it('a file with no collections', () => rejects('{"version":3}', /not a LifeOS backup/));

  // Forward compatibility: a newer file may use fields this build would drop.
  it('a backup from a newer version', () =>
    rejects(JSON.stringify({ version: BACKUP_VERSION + 1, collections: { tasks: [] } }), /newer version/));

  it('a collection that is not an array', () =>
    rejects(JSON.stringify({ version: 3, collections: { tasks: 'oops' } }), /malformed/));

  it('a structurally valid file with nothing in it', () =>
    rejects(JSON.stringify({ version: 3, collections: { unknownThing: [] } }), /no data/));
});

describe('parseBackup tolerates', () => {
  it('a backup with no preferences', () => {
    const p = parseBackup(JSON.stringify({ version: 3, collections: { tasks: [{ id: 'a' }] } }));
    expect(p.preferences).toEqual({});
  });

  it('an empty collection alongside a populated one', () => {
    const p = parseBackup(JSON.stringify({ version: 3, collections: { tasks: [], domains: [{ id: 'd' }] } }));
    expect(p.counts).toEqual({ tasks: 0, domains: 1 });
  });

  it('non-string preference values by dropping them', () => {
    const p = parseBackup(JSON.stringify({
      version: 3, collections: { tasks: [] }, preferences: { good: 'x', bad: 5 },
    }));
    expect(p.preferences).toEqual({ good: 'x' });
  });
});
