// Dirty-state comparison for settings forms. A field being touched is not a change:
// toggling a switch on and back off leaves the form equal to what is persisted.
// Pure (Node-testable).

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = stable((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function hasUnsavedChanges(current: unknown, saved: unknown): boolean {
  return JSON.stringify(stable(current)) !== JSON.stringify(stable(saved));
}

export type UnsavedChoice = 'save' | 'discard' | 'keep';

export const UNSAVED_COPY = {
  title: 'Unsaved changes',
  message: 'You have changes that haven’t been saved.',
  save: 'Save Changes',
  discard: 'Discard Changes',
  keep: 'Keep Editing',
} as const;
