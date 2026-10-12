/**
 * Unsaved-changes detection: the form is dirty only when it differs from the persisted
 * value — not merely because a field was touched. Pure Node tests.
 */
import { test, expect } from '@playwright/test';
import { hasUnsavedChanges, UNSAVED_COPY } from '../src/lib/unsavedChanges';

const saved = { announcements: true, booking_confirmations: true, match_invitations: false };

test.describe('hasUnsavedChanges', () => {
  test('identical values are clean', () => {
    expect(hasUnsavedChanges({ ...saved }, saved)).toBe(false);
  });

  test('toggling a switch and toggling it back is clean (touched ≠ changed)', () => {
    const toggledTwice = { ...saved, announcements: !(!saved.announcements) };
    expect(hasUnsavedChanges(toggledTwice, saved)).toBe(false);
  });

  test('a real difference is dirty', () => {
    expect(hasUnsavedChanges({ ...saved, announcements: false }, saved)).toBe(true);
  });

  test('key order does not matter', () => {
    const reordered = { match_invitations: false, announcements: true, booking_confirmations: true };
    expect(hasUnsavedChanges(reordered, saved)).toBe(false);
  });

  test('after a successful save the new value is the baseline (no repeat prompt)', () => {
    const edited = { ...saved, announcements: false };
    expect(hasUnsavedChanges(edited, saved)).toBe(true);
    const newBaseline = edited;
    expect(hasUnsavedChanges(edited, newBaseline)).toBe(false);
  });

  test('nested arrays and objects compare by value', () => {
    expect(hasUnsavedChanges({ goals: ['a', 'b'], loc: { id: 1 } }, { goals: ['a', 'b'], loc: { id: 1 } })).toBe(false);
    expect(hasUnsavedChanges({ goals: ['b', 'a'] }, { goals: ['a', 'b'] })).toBe(true);
  });

  test('dialog offers exactly Save / Discard / Keep Editing', () => {
    expect(UNSAVED_COPY.save).toBe('Save Changes');
    expect(UNSAVED_COPY.discard).toBe('Discard Changes');
    expect(UNSAVED_COPY.keep).toBe('Keep Editing');
  });
});
