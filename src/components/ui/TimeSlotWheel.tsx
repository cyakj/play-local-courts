import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Availability, Colors, FontFamily, Radius } from '@/constants/design';
import type { SlotInfo } from '@/lib/slotAvailability';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Wheel dimensions ─────────────────────────────────────────────────────────

const ITEM_H  = 52;
const VISIBLE = 7;
const WHEEL_H = ITEM_H * VISIBLE;          // 364 — default before the container is measured
const MIN_H   = ITEM_H * 3;                // never smaller than 3 rows

// ─── Cylinder transform tables ────────────────────────────────────────────────
// Each row is scaled & faded based on distance from the center row,
// simulating the curved surface of a rotating drum (Apple picker wheel style).
// scaleY compresses row content vertically — the primary cue that rows "curve away".

const CSCALE_Y  = [1.00, 0.68, 0.34, 0.12] as const;  // vertical compression
const COPACITY  = [1.00, 0.55, 0.22, 0.07] as const;  // opacity falloff

function cylT(dist: number) {
  const i = Math.min(dist, 3) as 0 | 1 | 2 | 3;
  return { scaleY: CSCALE_Y[i], opacity: COPACITY[i] };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WheelWeatherSource {
  tempF: number;
  rainPct: number;
  hourlyTemp: number[];
  hourlyRain: number[];
}

interface SlotWx {
  iconType: 'sun' | 'cloud' | 'rain' | 'storm';
  temp: number;
  condition: string;
}

export interface TimeSlotWheelProps {
  /** Every candidate start with its availability; unavailable ones stay visible but disabled. */
  slots: (SlotInfo | string)[];
  /** Fill the parent's height (reservation sheet). Default keeps the legacy fixed 7-row height used elsewhere. */
  fill?: boolean;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
  weather: WheelWeatherSource | null;
  outdoor: boolean;
  sheetDate: Date;
  now: Date;
  theme: ThemeTokens;
}

// ─── Weather helpers ──────────────────────────────────────────────────────────

function hourlyIdx(selected: Date, hour: number, now: Date): number {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selMidnight   = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
  const dayDiff = Math.round(
    (selMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, dayDiff * 24 + hour);
}

// Returns null when the forecast does not cover this hour: showing today's temperature for a day beyond the forecast
// would be fabricated data.
function wxForSlot(slot: string, date: Date, now: Date, wx: WheelWeatherSource): SlotWx | null {
  const hour = parseInt(slot.split(':')[0], 10);
  const idx  = hourlyIdx(date, hour, now);
  const t = wx.hourlyTemp[idx];
  const r = wx.hourlyRain[idx];
  if (typeof t !== 'number' || typeof r !== 'number') return null;
  const temp = Math.round(t);
  const rain = r;

  if (rain >= 70) return { iconType: 'storm', temp, condition: 'Storm' };
  if (rain >= 45) return { iconType: 'rain',  temp, condition: 'Rain' };
  if (rain >= 20) return { iconType: 'cloud', temp, condition: 'Overcast' };
  if (temp >= 95)  return { iconType: 'sun',   temp, condition: 'Heat' };
  if (temp >= 85)  return { iconType: 'sun',   temp, condition: 'Warm' };
  return                 { iconType: 'sun',   temp, condition: 'Clear' };
}

function fmtSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ─── Premium SVG weather icons ────────────────────────────────────────────────
// Rendered via react-native-svg so they scale crisply at any density.
// Color palette mirrors Apple Weather: amber sun, steel-blue clouds, sky-blue rain.

const SUN_COLOR    = '#F59E0B';  // warm amber
const CLOUD_COLOR  = '#94A3B8';  // steel blue-grey (visible on dark + light bg)
const CLOUD_DARK   = '#64748B';  // darker cloud for storm
const RAIN_COLOR   = '#93C5FD';  // sky blue rain drops
const BOLT_COLOR   = '#FCD34D';  // yellow lightning

// Reusable cloud shape: 3 overlapping circles + filled rectangle base
function CloudShape({
  fill, cx = 9, cy = 10, scale = 1,
}: {
  fill: string; cx?: number; cy?: number; scale?: number;
}) {
  const s = scale;
  return (
    <>
      <Rect
        x={cx - 7 * s} y={cy - 1 * s}
        width={14 * s} height={6 * s}
        rx={3 * s} fill={fill}
      />
      <Circle cx={cx - 4 * s} cy={cy - 1 * s} r={3.2 * s} fill={fill} />
      <Circle cx={cx}          cy={cy - 3 * s} r={3.8 * s} fill={fill} />
      <Circle cx={cx + 4 * s}  cy={cy - 1 * s} r={2.8 * s} fill={fill} />
    </>
  );
}

// Sun body + 8 spoke rays
function SunShape({
  cx = 10, cy = 10, coreR = 3.6, innerR = 5.4, outerR = 8.2, rayW = 1.6,
}: {
  cx?: number; cy?: number;
  coreR?: number; innerR?: number; outerR?: number; rayW?: number;
}) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <>
      <G stroke={SUN_COLOR} strokeWidth={rayW} strokeLinecap="round">
        {angles.map(deg => {
          const r = (deg - 90) * (Math.PI / 180);
          return (
            <Line
              key={deg}
              x1={cx + innerR * Math.cos(r)} y1={cy + innerR * Math.sin(r)}
              x2={cx + outerR * Math.cos(r)} y2={cy + outerR * Math.sin(r)}
            />
          );
        })}
      </G>
      <Circle cx={cx} cy={cy} r={coreR} fill={SUN_COLOR} />
    </>
  );
}

// Icon: Clear / Sun
function IconSun({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <SunShape />
    </Svg>
  );
}

// Icon: Partly Cloudy (small sun upper-right, cloud lower-left)
function IconCloud({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      {/* Small sun, offset to upper-right */}
      <SunShape
        cx={14} cy={6}
        coreR={2.2} innerR={3.4} outerR={5.0} rayW={1.2}
      />
      {/* Cloud, slightly larger, overlapping sun lower-left */}
      <CloudShape fill={CLOUD_COLOR} cx={9} cy={13} scale={0.88} />
    </Svg>
  );
}

// Icon: Rain (cloud + diagonal rain drops)
function IconRain({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <CloudShape fill={CLOUD_COLOR} cx={10} cy={8} scale={0.90} />
      {/* 3 diagonal rain lines */}
      <G stroke={RAIN_COLOR} strokeWidth={1.5} strokeLinecap="round">
        <Line x1={5.5}  y1={14} x2={4.0}  y2={18} />
        <Line x1={10.0} y1={14} x2={8.5}  y2={18} />
        <Line x1={14.5} y1={14} x2={13.0} y2={18} />
      </G>
    </Svg>
  );
}

// Icon: Storm (dark cloud + lightning bolt)
function IconStorm({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <CloudShape fill={CLOUD_DARK} cx={10} cy={7} scale={0.88} />
      {/* Lightning bolt centered below cloud */}
      <Path
        d="M11.5 12 L7.5 17 L10.5 17 L9.5 21 L14.5 15 L11.5 15 Z"
        fill={BOLT_COLOR}
      />
    </Svg>
  );
}

function WxIcon({ type, size }: { type: SlotWx['iconType']; size: number }) {
  if (type === 'sun')   return <IconSun size={size} />;
  if (type === 'rain')  return <IconRain size={size} />;
  if (type === 'storm') return <IconStorm size={size} />;
  return <IconCloud size={size} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

const STATE_LABEL = { reserved: 'Reserved', blocked: 'Blocked', limit: 'Limit' } as const;

function a11yLabel(slot: SlotInfo, isSelected: boolean): string {
  const t = fmtSlot(slot.start);
  if (isSelected) return `${t}, selected`;
  if (slot.state === 'available') return `${t}, available`;
  if (slot.state === 'blocked') return `${t}, blocked by management, unavailable`;
  if (slot.state === 'limit') return `${t}, reservation limit reached, unavailable`;
  return `${t}, ${slot.mine && slot.pending ? 'your request, pending approval' : slot.mine ? 'reserved by you' : slot.inside === false ? 'would overlap a reservation' : 'reserved'}, unavailable`;
}

/**
 * The wheel fills whatever height its parent gives it (flex: 1) and is the ONLY vertical scroller in the
 * reservation sheet. It measures itself, so there is no per-device height.
 */
export const TimeSlotWheel = memo(function TimeSlotWheel({
  slots: rawSlots, fill = false, selectedSlot, onSelectSlot,
  weather, outdoor, sheetDate, now, theme,
}: TimeSlotWheelProps) {
  const slots = useMemo<SlotInfo[]>(
    () => rawSlots.map((x) => (typeof x === 'string' ? { start: x, state: 'available' as const } : x)),
    [rawSlots],
  );
  const scrollRef  = useRef<ScrollViewInstance>(null);
  const lastIdxRef = useRef(0);
  const [centeredIdx, setCenteredIdx] = useState(0);
  const [wheelH, setWheelH] = useState(WHEEL_H);
  const s = useWheelStyles(theme);
  const pad = Math.max(0, (wheelH - ITEM_H) / 2);
  const starts = useMemo(() => slots.map((x) => x.start), [slots]);

  useEffect(() => {
    if (slots.length === 0) return;
    // Land on the selection, else the first bookable time, else the top.
    const sel = selectedSlot ? starts.indexOf(selectedSlot) : -1;
    const firstOpen = slots.findIndex((x) => x.state === 'available');
    const target = sel >= 0 ? sel : Math.max(0, firstOpen);
    lastIdxRef.current = target;
    setCenteredIdx(target);
    const tid = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: target * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, wheelH]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = e.nativeEvent.contentOffset.y;
      const idx = Math.max(0, Math.min(Math.round(raw / ITEM_H), slots.length - 1));
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        setCenteredIdx(idx);
      }
    },
    [slots.length],
  );

  const handleSelect = useCallback(
    (slot: SlotInfo, idx: number) => {
      if (slot.state !== 'available') return; // disabled rows never select
      const next = slot.start === selectedSlot ? null : slot.start;
      onSelectSlot(next);
      if (next !== null) {
        lastIdxRef.current = idx;
        setCenteredIdx(idx);
        scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
      }
    },
    [selectedSlot, onSelectSlot],
  );

  return (
    <View
      style={[s.wheel, fill ? { flex: 1, minHeight: MIN_H } : { height: WHEEL_H, marginBottom: 12 }]}
      onLayout={fill ? (e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && Math.abs(h - wheelH) > 1) setWheelH(h);
      } : undefined}>
      <ScrollView
        ref={scrollRef}
        testID="time-slot-wheel"
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {slots.map((slot, i) => {
          const dist       = Math.abs(i - centeredIdx);
          const open       = slot.state === 'available';
          const isCentered = i === centeredIdx;
          const isSelected = slot.start === selectedSlot;
          const { scaleY, opacity } = cylT(dist);
          const wx = open && outdoor && weather ? wxForSlot(slot.start, sheetDate, now, weather) : null;

          return (
            <View
              key={slot.start}
              testID={`wheel-row-${slot.start}`}
              style={[
                s.row,
                { opacity },
                slot.state === 'reserved' && !slot.mine && s.rowReserved,
                slot.state === 'reserved' && slot.mine && !slot.pending && s.rowMine,
                slot.state === 'reserved' && slot.mine && slot.pending && s.rowPending,
                slot.state === 'blocked' && s.rowBlocked,
                open && isCentered && s.rowFocused,
                isSelected && s.rowSelected,
              ]}
            >
              <View style={[s.rowInner, { transform: [{ scaleY }] }]}>
                <View style={[s.dot, { backgroundColor: open ? Availability.available : slot.state === 'blocked' ? Availability.blocked : slot.mine && slot.pending ? Availability.minePending : slot.mine ? Availability.mine : Availability.reserved }]} />
                <Text
                  testID={`wheel-time-${slot.start}`}
                  style={[s.time, open && isCentered && s.timeFocused, !open && s.timeDisabled]}
                  numberOfLines={1}
                >
                  {fmtSlot(slot.start)}
                </Text>

                {/* Weather: only for bookable outdoor times, only when real data exists */}
                {wx ? (
                  <View style={s.wxArea}>
                    <WxIcon type={wx.iconType} size={isCentered ? 20 : 18} />
                    <Text style={[s.temp, isCentered && s.tempFocused]}>{wx.temp}°F</Text>
                    <Text style={[s.cond, isCentered && s.condFocused]} numberOfLines={1}>
                      {wx.condition}
                    </Text>
                  </View>
                ) : (
                  <View style={s.wxSpacer} />
                )}

                {open ? (
                  <TouchableOpacity
                    testID={`wheel-select-${slot.start}`}
                    style={[s.btn, isSelected && s.btnActive]}
                    onPress={() => handleSelect(slot, i)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel(slot, isSelected)}
                    accessibilityState={{ selected: isSelected }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[s.btnLabel, isSelected && s.btnLabelActive]}>
                      {isSelected ? '✓' : 'Select'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    testID={`wheel-unavailable-${slot.start}`}
                    accessible
                    accessibilityLabel={a11yLabel(slot, false)}
                    accessibilityState={{ disabled: true }}
                    style={[s.statePill, slot.state === 'blocked' ? s.statePillBlocked : slot.mine && slot.pending ? s.statePillPending : slot.mine ? s.statePillMine : s.statePillReserved]}
                  >
                    <Text style={[s.statePillText, { color: slot.state === 'blocked' ? Availability.blocked : slot.mine && slot.pending ? Availability.minePending : slot.mine ? theme.textPrimary : theme.textMuted }]}>
                      {slot.state === 'reserved' && slot.mine && slot.pending ? 'Pending' : slot.state === 'reserved' && slot.mine ? 'Yours' : slot.state === 'reserved' && slot.inside === false ? 'Overlaps' : STATE_LABEL[slot.state as 'reserved' | 'blocked' | 'limit']}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

/** Compact legend for the wheel; uses the shared semantic availability colors. */
export function AvailabilityLegend({ theme }: { theme: ThemeTokens }) {
  const items = [
    { color: Availability.available, label: 'Available' },
    { color: Availability.mine, label: 'Yours' },
    { color: Availability.reserved, label: 'Reserved' },
    { color: Availability.blocked, label: 'Blocked' },
    { color: Availability.selected, label: 'Selected' },
  ];
  return (
    <View testID="availability-legend" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingVertical: 6 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color }} />
          <Text style={{ fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function useWheelStyles(theme: ThemeTokens) {
  return useMemo(() => {
    const selBlue   = Availability.selected;
    const selBlueBg = 'rgba(45,107,255,0.09)';

    return StyleSheet.create({
      wheel: {
        overflow: 'hidden',
        borderRadius: Radius.card,
        backgroundColor: theme.sheetBg,
        borderWidth: 1,
        borderColor: theme.border,
      },
      row: {
        height: ITEM_H,
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: Radius.sm,
        marginHorizontal: 4,
      },
      rowFocused: { borderColor: selBlue, backgroundColor: selBlueBg },
      rowSelected: { borderColor: selBlue, backgroundColor: selBlueBg },
      rowReserved: { backgroundColor: Availability.reservedBg },
      rowBlocked: { backgroundColor: Availability.blockedBg },
      rowMine: { backgroundColor: Availability.mineBg },
      rowPending: { backgroundColor: Availability.minePendingBg },
      rowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        gap: 8,
      },
      dot: { width: 8, height: 8, borderRadius: 4 },
      time: {
        fontFamily: FontFamily.manropeSemiBold,
        fontSize: 15,
        color: theme.textMuted,
        width: 80,
      },
      timeFocused: { color: theme.textPrimary, fontFamily: FontFamily.manropeBold },
      timeDisabled: { color: theme.textMuted, textDecorationLine: 'line-through' },
      wxArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
      wxSpacer: { flex: 1 },
      temp: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textMuted, minWidth: 34 },
      tempFocused: { color: Colors.blue },
      cond: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textMuted, flexShrink: 1 },
      condFocused: { color: theme.textSecondary },
      btn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface2,
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
      },
      btnActive: { backgroundColor: selBlue, borderColor: selBlue },
      btnLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: theme.textMuted },
      btnLabelActive: { color: '#FFFFFF' },
      statePill: {
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, minWidth: 72,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1,
      },
      statePillReserved: { borderColor: 'rgba(122,131,154,0.35)' },
      statePillBlocked: { borderColor: Availability.blocked, backgroundColor: Availability.blockedBg },
      statePillPending: { borderColor: Availability.minePending, backgroundColor: Availability.minePendingBg },
      statePillMine: { borderColor: Availability.mine, backgroundColor: Availability.mineBg },
      statePillText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 0.4 },
    });
  }, [theme]);
}
