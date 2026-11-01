import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { DEFAULT_PICKER_PREFS, parsePickerPrefs, type PickerPrefs } from '@/lib/pickerFeedback';

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
/** The subtle tick when the centred time changes. */
export function hapticTick(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => { /* unsupported / disabled */ });
}
/** A slightly firmer confirmation when the user intentionally picks a time. */
export function hapticConfirm(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* unsupported / disabled */ });
}

// ── sound ────────────────────────────────────────────────────────────────────
let player: AudioPlayer | null = null;
let audioReady = false;

async function ensurePlayer(): Promise<AudioPlayer | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (!audioReady) {
      audioReady = true;
      // Respect the iPhone silent switch, mix with whatever else is playing, never keep the audio session alive in the background.
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    }
    if (!player) player = createAudioPlayer(require('../../assets/sounds/picker-tick.wav'));
    return player;
  } catch { return null; }
}

/** Preload when the sound is switched on so the first tick has no latency. */
export function warmPickerSound(): void { void ensurePlayer(); }

export function soundTick(): void {
  if (!player) { void ensurePlayer(); return; } // first call only warms up; later ticks play
  try {
    player.seekTo(0).then(() => player?.play()).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}
