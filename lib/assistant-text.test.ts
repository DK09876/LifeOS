import { describe, expect, it } from 'vitest';

import { findByName, listing, nameScore, resolveDay, sayDay } from './assistant-text';

// Friday 9 October 2026
const T = '2026-10-09';

describe('resolveDay', () => {
  it('reads the common words', () => {
    expect(resolveDay('today', T)).toBe(T);
    expect(resolveDay('tomorrow', T)).toBe('2026-10-10');
    expect(resolveDay('yesterday', T)).toBe('2026-10-08');
    expect(resolveDay('in 3 days', T)).toBe('2026-10-12');
    expect(resolveDay('2026-11-02', T)).toBe('2026-11-02');
  });

  it('takes a weekday as the next one, today included', () => {
    expect(resolveDay('Friday', T)).toBe(T);
    expect(resolveDay('saturday', T)).toBe('2026-10-10');
    expect(resolveDay('on Monday', T)).toBe('2026-10-12');
    expect(resolveDay('this weekend', T)).toBe('2026-10-10');
  });

  it('takes "next Friday" as Friday of next week', () => {
    expect(resolveDay('next friday', T)).toBe('2026-10-16');
    expect(resolveDay('next monday', T)).toBe('2026-10-12');
  });

  it('reads a day of the month as the next one', () => {
    expect(resolveDay('the 30th', T)).toBe('2026-10-30');
    expect(resolveDay('3rd', T)).toBe('2026-11-03');
  });

  it('says it does not know rather than guessing', () => {
    expect(resolveDay('someday soon', T)).toBeNull();
  });
});

describe('names', () => {
  it('scores exact, prefix and word-form matches', () => {
    expect(nameScore('laundry', 'Laundry')).toBe(100);
    expect(nameScore('the dishes', 'Dishes')).toBe(95);
    expect(nameScore('dish', 'Dishes')).toBeGreaterThanOrEqual(40);
    expect(nameScore('meditation', 'Meditate')).toBeGreaterThanOrEqual(40);
    expect(nameScore('gym', 'Laundry')).toBe(0);
  });

  it('prefers the exact name over a longer one', () => {
    const items = ['Dishes', 'Dishes unloaded'];
    expect(findByName(items, 'dishes', (x) => x)).toEqual({ kind: 'one', item: 'Dishes' });
  });

  it('calls a tie ambiguous', () => {
    expect(findByName(['Call mom', 'Call dad'], 'call', (x) => x).kind).toBe('ambiguous');
  });
});

describe('speaking', () => {
  it('reads dates relative to today', () => {
    expect(sayDay(T, T)).toBe('today');
    expect(sayDay('2026-10-10', T)).toBe('tomorrow');
    expect(sayDay('2026-10-13', T)).toBe('Tuesday');
    expect(sayDay('2026-10-30', T)).toBe('Friday October 30');
  });

  it('joins lists naturally', () => {
    expect(listing(['a'])).toBe('a');
    expect(listing(['a', 'b', 'c'])).toBe('a, b and c');
    expect(listing(['a', 'b', 'c', 'd'], 2)).toBe('a, b and 2 more');
  });
});
