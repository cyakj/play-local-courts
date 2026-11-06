import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import {
  DEFAULT_PICKER_PREFS, PICKER_HAPTIC_CONFIRM, PICKER_HAPTIC_TICK, PICKER_SOUND_VOLUME, parsePickerPrefs, type PickerPrefs,
} from '@/lib/pickerFeedback';

// Runtime side of the picker feedback: preferences (persisted), the haptic tick and the optional sound.
// Everything is best-effort: an unsupported device, a disabled Taptic Engine or an audio failure never breaks the picker.

const KEY = 'tenisx.pickerFeedback.v1';
let prefs: PickerPrefs = { ...DEFAULT_PICKER_PREFS };
let loaded = false;
const listeners = new Set<(p: PickerPrefs) => void>();

export async function loadPickerPrefs(): Promise<PickerPrefs> {
  if (!loaded) {
    loaded = true;
    try { prefs = parsePickerPrefs(await AsyncStorage.getItem(KEY)); } catch { /* defaults */ }
    listeners.forEach((l) => l(prefs));
  }
  return prefs;
}
export const getPickerPrefs = (): PickerPrefs => prefs;
export function subscribePickerPrefs(l: (p: PickerPrefs) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export async function setPickerPrefs(next: Partial<PickerPrefs>): Promise<void> {
  prefs = { ...prefs, ...next };
  listeners.forEach((l) => l(prefs));
  try { await AsyncStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* keep in memory */ }
}

// ── haptics ──────────────────────────────────────────────────────────────────
// One call per tick, never several overlapping ones. Styles come from the central tunables in pickerFeedback.ts.
const HAPTIC_STYLE = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
} as const;

/** The tick when the centred time changes: a Light impact (the old selection tick was too faint). */
export function hapticTick(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(HAPTIC_STYLE[PICKER_HAPTIC_TICK]).catch(() => { /* unsupported / disabled */ });
}
/** A firmer confirmation when the user intentionally picks a time. */
export function hapticConfirm(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(HAPTIC_STYLE[PICKER_HAPTIC_CONFIRM]).catch(() => { /* unsupported / disabled */ });
}

// ── sound ────────────────────────────────────────────────────────────────────
// A tiny pool of preloaded players. The ~22 ms clip is played immediately from a "ready" (rewound) player; the player is
// rewound again shortly after it ends. A tick with no ready player is DROPPED, never queued, so a fast flick cannot produce a
// late burst, overlapping loud playback or a backlog. Players are created once and released when no wheel is mounted.
const POOL_SIZE = 4;
const REWIND_AFTER_MS = 30; // the clip is ~22 ms
interface Slot { player: AudioPlayer; ready: boolean }
let pool: Slot[] = [];
let poolPromise: Promise<void> | null = null;
let audioReady = false;
let users = 0;
let nextSlot = 0;
let timers = new Set<ReturnType<typeof setTimeout>>();

async function ensurePool(): Promise<void> {
  if (Platform.OS === 'web' || pool.length > 0) return;
  if (!poolPromise) {
    poolPromise = (async () => {
      try {
        if (!audioReady) {
          audioReady = true;
          // Respect the iPhone silent switch, mix with whatever else is playing, never keep the audio session alive in the background.
          await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
        }
        if (users === 0) return; // released while loading
        const src = require('../../assets/sounds/picker-tick.wav');
        pool = Array.from({ length: POOL_SIZE }, () => {
          const player = createAudioPlayer(src);
          player.volume = PICKER_SOUND_VOLUME;
          return { player, ready: true };
        });
      } catch { pool = []; }
      finally { poolPromise = null; }
    })();
  }
  await poolPromise;
}

/** Call when a wheel mounts. Returns the matching release (call on unmount): the players are freed when the last wheel goes. */
export function acquirePickerSound(): () => void {
  users += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    users = Math.max(0, users - 1);
    if (users === 0) releasePickerSound();
  };
}

export function releasePickerSound(): void {
  timers.forEach(clearTimeout);
  timers = new Set();
  for (const { player } of pool) { try { player.pause(); player.remove(); } catch { /* already gone */ } }
  pool = [];
  nextSlot = 0;
}

/** Preload when the sound is switched on so the first tick has no latency. */
export function warmPickerSound(): void { void ensurePool(); }

export function soundTick(): void {
  if (pool.length === 0) { void ensurePool(); return; } // first call only warms up; later ticks play
  for (let n = 0; n < pool.length; n++) {
    const slot = pool[(nextSlot + n) % pool.length];
    if (!slot.ready) continue;
    nextSlot = (nextSlot + n + 1) % pool.length;
    slot.ready = false;
    try { slot.player.volume = PICKER_SOUND_VOLUME; slot.player.play(); } catch { slot.ready = true; return; }
    const t = setTimeout(() => {
      timers.delete(t);
      try { slot.player.seekTo(0).then(() => { slot.ready = true; }, () => { slot.ready = true; }); } catch { slot.ready = true; }
    }, REWIND_AFTER_MS);
    timers.add(t);
    return;
  }
  // every player is busy: drop this tick (no queue)
}
