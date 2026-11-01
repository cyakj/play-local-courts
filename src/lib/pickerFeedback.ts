// Pure logic for picker-wheel feedback (haptic tick + optional sound). No React Native imports so Node tests can run it.

/** Slot height-independent: which row is centred for a scroll offset (clamped to the list). */
export function centeredIndex(offsetY: number, itemHeight: number, count: number): number {
  if (count <= 0 || itemHeight <= 0) return 0;
  const raw = Math.round(offsetY / itemHeight);
  return Math.max(0, Math.min(raw, count - 1));
}

/** Minimum time between two ticks. A fast flick crosses a row every few ms; we feel/hear at most one per gap. */
export const HAPTIC_MIN_GAP_MS = 40;
export const SOUND_MIN_GAP_MS = 70;

export interface FeedbackGate { lastIdx: number | null; lastHapticAt: number; lastSoundAt: number }
export const newGate = (): FeedbackGate => ({ lastIdx: null, lastHapticAt: -Infinity, lastSoundAt: -Infinity });

export interface FeedbackDecision { gate: FeedbackGate; haptic: boolean; sound: boolean }

/**
 * Decide feedback for the centred row `idx` at time `now`.
 *  - nothing fires when the centred row has not changed (a re-render or data refresh never ticks);
 *  - the first observed index only seeds the gate (landing on the initial selection is not a user scroll);
 *  - `userDriven=false` (programmatic scrollTo, refresh) updates the gate silently;
 *  - haptic and sound are throttled independently, and each only when its preference is on.
 */
export function decideFeedback(
  gate: FeedbackGate, idx: number, now: number,
  opts: { userDriven: boolean; haptics: boolean; sound: boolean },
): FeedbackDecision {
  if (gate.lastIdx === null || !opts.userDriven || idx === gate.lastIdx) {
    return { gate: { ...gate, lastIdx: idx }, haptic: false, sound: false };
  }
  const haptic = opts.haptics && now - gate.lastHapticAt >= HAPTIC_MIN_GAP_MS;
  const sound = opts.sound && now - gate.lastSoundAt >= SOUND_MIN_GAP_MS;
  return {
    gate: { lastIdx: idx, lastHapticAt: haptic ? now : gate.lastHapticAt, lastSoundAt: sound ? now : gate.lastSoundAt },
    haptic, sound,
  };
}

export interface PickerPrefs { haptics: boolean; sound: boolean }
/** Haptics on by default; the sound is opt-in (silent by default). */
export const DEFAULT_PICKER_PREFS: PickerPrefs = { haptics: true, sound: false };

export function parsePickerPrefs(raw: string | null | undefined): PickerPrefs {
  if (!raw) return { ...DEFAULT_PICKER_PREFS };
  try {
    const v = JSON.parse(raw) as Partial<PickerPrefs> | null;
    return {
      haptics: typeof v?.haptics === 'boolean' ? v.haptics : DEFAULT_PICKER_PREFS.haptics,
      sound: typeof v?.sound === 'boolean' ? v.sound : DEFAULT_PICKER_PREFS.sound,
    };
  } catch { return { ...DEFAULT_PICKER_PREFS }; }
}
