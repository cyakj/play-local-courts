// Node-only: wheel haptics + sound tuning, staleness, settings, runtime wiring (source-level; no device).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  FEEDBACK_STALE_MS, HAPTIC_MIN_GAP_MS, PICKER_HAPTIC_CONFIRM, PICKER_HAPTIC_TICK, PICKER_SOUND_VOLUME, decideFeedback, newGate,
} from '../src/lib/pickerFeedback';

const read = (p: string) => readFileSync(p, 'utf8');
const on = { userDriven: true, haptics: true, sound: true };

test.describe('tuning constants', () => {
  test('sound is substantially quieter than full volume and centralised', () => {
    expect(PICKER_SOUND_VOLUME).toBeGreaterThan(0);
    expect(PICKER_SOUND_VOLUME).toBeLessThanOrEqual(0.5);
    const rt = read('src/lib/pickerFeedbackRuntime.ts');
    expect(rt).toContain('player.volume = PICKER_SOUND_VOLUME');
    expect(rt).not.toMatch(/volume = 1/);
  });
  test('haptics are stronger than the old selection tick, and confirm is stronger than the tick', () => {
    expect(PICKER_HAPTIC_TICK).toBe('light');
    expect(PICKER_HAPTIC_CONFIRM).toBe('medium');
    const rt = read('src/lib/pickerFeedbackRuntime.ts');
    expect(rt).not.toContain('selectionAsync');
    // exactly one haptic call per tick / confirm
    expect((rt.match(/Haptics\.impactAsync/g) ?? []).length).toBe(2);
  });
});

test.describe('timing: no backlog', () => {
  test('a row change reported late (busy JS thread) is dropped, silently updating the gate', () => {
    const g = decideFeedback(newGate(), 0, 0, on).gate;
    const late = decideFeedback(g, 1, 1000 + FEEDBACK_STALE_MS + 1, { ...on, eventAt: 1000 });
    expect(late.haptic || late.sound).toBe(false);
    expect(late.gate.lastIdx).toBe(1);
    const fresh = decideFeedback(g, 1, 1000 + 10, { ...on, eventAt: 1000 });
    expect(fresh.haptic).toBe(true);
    expect(fresh.sound).toBe(true);
  });
  test('slow scrolling: every row change ticks; fast flick: bounded by the gap, not by the number of rows', () => {
    let g = decideFeedback(newGate(), 0, 0, on).gate;
    let slow = 0;
    for (let i = 1; i <= 10; i++) { const d = decideFeedback(g, i, i * 120, on); g = d.gate; if (d.haptic) slow++; }
    expect(slow).toBe(10);
    g = decideFeedback(newGate(), 0, 0, on).gate;
    let fast = 0;
    for (let i = 1; i <= 40; i++) { const d = decideFeedback(g, i, i * 4, on); g = d.gate; if (d.haptic) fast++; } // 160 ms, 40 rows
    expect(fast).toBeLessThanOrEqual(Math.ceil(160 / HAPTIC_MIN_GAP_MS) + 1);
  });
  test('no feedback on initial load, programmatic scroll, or when disabled', () => {
    expect(decideFeedback(newGate(), 7, 0, on)).toMatchObject({ haptic: false, sound: false });
    const g = decideFeedback(newGate(), 0, 0, on).gate;
    expect(decideFeedback(g, 5, 500, { ...on, userDriven: false })).toMatchObject({ haptic: false, sound: false });
    expect(decideFeedback(g, 5, 500, { userDriven: true, haptics: false, sound: false })).toMatchObject({ haptic: false, sound: false });
  });
  test('haptics remain useful with sound off', () => {
    const g = decideFeedback(newGate(), 0, 0, on).gate;
    expect(decideFeedback(g, 1, 500, { userDriven: true, haptics: true, sound: false })).toMatchObject({ haptic: true, sound: false });
  });
});

test.describe('audio runtime wiring', () => {
  const rt = read('src/lib/pickerFeedbackRuntime.ts');
  test('players are created once in a pool, never per tick; a busy pool drops ticks instead of queueing', () => {
    expect((rt.match(/createAudioPlayer\(/g) ?? []).length).toBe(1);
    expect(rt).toContain('// every player is busy: drop this tick (no queue)');
    expect(rt).not.toMatch(/seekTo\(0\)\.then\(\(\) => player/);
  });
  test('cleanup: timers cleared and players removed when the last wheel unmounts', () => {
    expect(rt).toContain('timers.forEach(clearTimeout)');
    expect(rt).toContain('player.remove()');
    const w = read('src/components/ui/TimeSlotWheel.tsx');
    expect(w).toContain('acquirePickerSound()');
    expect(w).toMatch(/return \(\) => \{ unsub\(\); release\(\); \}/);
  });
  test('silent switch and mixing preserved; sound still off by default', () => {
    expect(rt).toContain("playsInSilentMode: false");
    expect(rt).toContain("interruptionMode: 'mixWithOthers'");
    expect(rt).toContain('shouldPlayInBackground: false');
  });
  test('the wheel passes the UI-thread event time so stale ticks can be dropped', () => {
    const w = read('src/components/ui/TimeSlotWheel.tsx');
    expect(w).toContain('scheduleOnRN(onCentreChange, idx, Date.now())');
    expect(w).toContain('eventAt');
  });
});
