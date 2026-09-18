/**
 * Enter must not commit a half-filled form.
 *
 * This is the "the form closes by itself" bug: on a phone the return key is
 * the only obvious way to dismiss the keyboard, and in a single text input it
 * triggers the browser's implicit submission, saving the record and shutting
 * the dialog before the other fields have been touched.
 */

import { describe, expect, it, vi } from 'vitest';

import { blockImplicitSubmit } from './forms';

type Ev = Parameters<typeof blockImplicitSubmit>[0];

const event = (key: string, tagName: string, type = 'text', shiftKey = false) => {
  const blur = vi.fn();
  const preventDefault = vi.fn();
  const target = { tagName, type, blur } as unknown as HTMLElement;
  return { ev: { key, shiftKey, target, preventDefault } as unknown as Ev, blur, preventDefault };
};

describe('blockImplicitSubmit', () => {
  it('stops Enter in a text field and puts the keyboard away', () => {
    const { ev, blur, preventDefault } = event('Enter', 'INPUT', 'text');
    blockImplicitSubmit(ev);
    expect(preventDefault).toHaveBeenCalled();
    expect(blur).toHaveBeenCalled();
  });

  it('stops Enter in a date field too', () => {
    const { ev, preventDefault } = event('Enter', 'INPUT', 'date');
    blockImplicitSubmit(ev);
    expect(preventDefault).toHaveBeenCalled();
  });

  // A textarea's Enter is a newline, and the browser does not submit on it.
  it('leaves textareas alone', () => {
    const { ev, preventDefault } = event('Enter', 'TEXTAREA');
    blockImplicitSubmit(ev);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  // The Create button must still work from the keyboard.
  it('leaves the submit button alone', () => {
    const { ev, preventDefault } = event('Enter', 'INPUT', 'submit');
    blockImplicitSubmit(ev);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores every other key', () => {
    for (const key of ['a', 'Tab', 'Escape', 'ArrowDown']) {
      const { ev, preventDefault } = event(key, 'INPUT');
      blockImplicitSubmit(ev);
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  it('ignores shift-Enter', () => {
    const { ev, preventDefault } = event('Enter', 'INPUT', 'text', true);
    blockImplicitSubmit(ev);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('survives an event with no target', () => {
    expect(() => blockImplicitSubmit({ key: 'Enter', target: null, preventDefault: vi.fn() } as unknown as Ev))
      .not.toThrow();
  });
});
