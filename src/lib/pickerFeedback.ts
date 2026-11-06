// Pure logic for picker-wheel feedback (haptic tick + optional sound). No React Native imports so Node tests can run it.

/** Slot height-independent: which row is centred for a scroll offset (clamped to the list). */
export function centeredIndex(offsetY: number, itemHeight: number, count: number): number {
  'worklet'; // called from the UI-thread scroll handler in TimeSlotWheel
  if (count <= 0 || itemHeight <= 0) return 0;
  const raw = Math.round(offsetY / itemHeight);
  return Math.max(0, Math.min(raw, count - 1));
}

// ── Tunables (all feedback tuning lives here; physical-iPhone tuning is still required) ───────────────────────────────
/** Playback volume of the tick, 0..1. 0.35 is about -9 dB, i.e. roughly half the perceived loudness of the former full-volume tick. */
export const PICKER_SOUND_VOLUME = 0.35;
/** Haptic style names (mapped to expo-haptics in the runtime): the tick is a Light impact (clearly stronger than the old selection tick), selecting a time is Medium. */
export const PICKER_HAPTIC_TICK = 'light' as const;
export const PICKER_HAPTIC_CONFIRM = 'medium' as const;
/** Minimum time between two haptic ticks: a fast flick crosses a row every few ms; the Taptic Engine blurs anything denser. */
export const HAPTIC_MIN_GAP_MS = 40;
/** The tick clip is ~22 ms and played from a small player pool, so sound can follow rows more closely than haptics. */
export const SOUND_MIN_GAP_MS = 30;
/** A row change reported to JS later than this after it happened is dropped, so a busy JS thread never replays a backlog late. */
export const FEEDBACK_STALE_MS = 80;

export interface FeedbackGate { lastIdx: number | null; lastHapticAt: number; lastSoundAt: number }
export const newGate = (): FeedbackGate => ({ lastIdx: null, lastHapticAt: -Infinity, lastSoundAt: -Infinity });

export interface FeedbackDecision { gate: FeedbackGate; haptic: boolean; sound: boolean }

/**
 * Decide feedback for the centred row `idx` at time `now`.
 *  - nothing fires when the centred row has not changed (a re-render or data refresh never ticks);
 *  - the first observed index only seeds the gate (landing on the initial selection is not a user scroll);
 *  - `userDriven=false` (programmatic scrollTo, refresh) updates the gate silently;
 *  - `eventAt` (when the row change happened on the UI thread) older than FEEDBACK_STALE_MS updates the gate silently:
 *    a late tick would feel detached from the scroll;
 *  - haptic and sound are throttled independently, and each only when its preference is on.
 */
export function decideFeedback(
  gate: FeedbackGate, idx: number, now: number,
  opts: { userDriven: boolean; haptics: boolean; sound: boolean; eventAt?: number },
): FeedbackDecision {
  const stale = typeof opts.eventAt === 'number' && now - opts.eventAt > FEEDBACK_STALE_MS;
  if (gate.lastIdx === null || !opts.userDriven || idx === gate.lastIdx || stale) {
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
