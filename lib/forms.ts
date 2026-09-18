/**
 * Stop Enter in a text field committing a multi-field form.
 *
 * A form with a single text input submits when you press Enter in it - that
 * is the browser's implicit submission, and on a desktop it is a convenience.
 * On a phone it is a trap: the return key is the only obvious way to put the
 * keyboard away, so typing a name and reaching for it saved a half-filled
 * record and shut the form, which reads as the form closing by itself.
 *
 * Enter now means "I have finished with this field": the field blurs, which
 * is what dismisses the keyboard on iOS, and nothing is submitted until the
 * button is pressed. Textareas keep their newlines, and the submit button
 * still works from the keyboard.
 */
export function blockImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>): void {
  if (event.key !== 'Enter' || event.shiftKey) return;

  const target = event.target as HTMLElement | null;
  if (!target || target.tagName !== 'INPUT') return;

  const type = (target as HTMLInputElement).type;
  // Buttons are meant to fire on Enter, and so are the native pickers, whose
  // own popovers handle the key themselves.
  if (type === 'submit' || type === 'button' || type === 'reset') return;

  event.preventDefault();
  target.blur();
}
