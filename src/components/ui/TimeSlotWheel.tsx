import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation, interpolate, interpolateColor, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { DRUM_OPACITY_STOPS, wheelPad } from '@/lib/wheelLayout';
import { centeredIndex, decideFeedback, newGate, type FeedbackGate } from '@/lib/pickerFeedback';
import {
  getPickerPrefs, hapticConfirm, hapticTick, loadPickerPrefs, soundTick, subscribePickerPrefs, warmPickerSound,
} from '@/lib/pickerFeedbackRuntime';
import { Availability, Colors, FontFamily, Radius } from '@/constants/design';
import type { SlotInfo } from '@/lib/slotAvailability';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Wheel dimensions ─────────────────────────────────────────────────────────

const ITEM_H  = 44;
const VISIBLE = 7;
const WHEEL_H = ITEM_H * VISIBLE;          // 308 - default before the container is measured (the sheet fills ~7-9 rows)
const MIN_H   = ITEM_H * 3;                // never smaller than 3 rows

// Drum geometry: each row tilts about its horizontal axis in proportion to its distance from the centre (subtle, not extreme).
const DRUM_PERSPECTIVE = 520;
const DRUM_DEG_PER_ROW = 21;
const DRUM_MAX_DEG = 62;

// Cylinder silhouette: two mirrored parabolic contours, widest at the centre row and pinched toward the top/bottom. Row width
// follows the same parabola, so the rows sit inside the contours instead of beside them.
const CONTOUR_EDGE = 3;                    // contour x at the widest point (inside the wheel border)
const ROW_MARGIN = 8;                      // 2 x row marginHorizontal

interface Cylinder { bow: number; rowW: number; half: number }

/** Horizontal pinch at the wheel ends, in px per side; scales with the measured width so it fits any iPhone. */
function cylinderFor(width: number, height: number): Cylinder {
  const bow = Math.max(6, Math.min(26, width * 0.06));
  return { bow, rowW: Math.max(1, width - ROW_MARGIN), half: Math.max(ITEM_H, height / 2) };
}

function contourPath(width: number, height: number, bow: number, side: 'left' | 'right'): string {
  const mid = height / 2;
  const edge = side === 'left' ? CONTOUR_EDGE : width - CONTOUR_EDGE;
  const dir = side === 'left' ? 1 : -1;
  const endX = edge + dir * bow;
  const ctrlX = edge - dir * bow;           // quadratic midpoint lands exactly on `edge`
  return `M ${endX} 0 Q ${ctrlX} ${mid} ${endX} ${height}`;
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

const STATE_LABEL = { reserved: 'Reserved', blocked: 'Blocked', limit: 'Daily limit' } as const;

function a11yLabel(slot: SlotInfo, isSelected: boolean): string {
  const t = fmtSlot(slot.start);
  if (isSelected) return `${t}, selected`;
  if (slot.state === 'available') return `${t}, available`;
  if (slot.state === 'blocked') return `${t}, blocked by management, unavailable`;
  if (slot.state === 'limit') return `${t}, daily reservation limit reached, unavailable`;
  return `${t}, ${slot.mine && slot.pending ? 'your request, pending approval' : slot.mine ? 'reserved by you' : slot.inside === false ? 'would overlap a reservation' : 'reserved'}, unavailable`;
}

interface WheelRowProps {
  slot: SlotInfo; index: number; scrollY: SharedValue<number>; isSelected: boolean;
  wx: SlotWx | null; theme: ThemeTokens; s: ReturnType<typeof useWheelStyles>; onSelect: (slot: SlotInfo, idx: number) => void;
  cyl: Cylinder;
}

/** One drum row. Its curvature, scale, opacity and text colour are driven by the scroll offset on the UI thread. */
const WheelRow = memo(function WheelRow({ slot, index, scrollY, isSelected, wx, theme, s, onSelect, cyl }: WheelRowProps) {
  const open = slot.state === 'available';
  const focusColor = theme.textPrimary;
  const restColor = theme.textMuted;
  const drum = useAnimatedStyle(() => {
    const d = (index * ITEM_H - scrollY.value) / ITEM_H;   // signed distance from the centre, in rows
    const ad = Math.abs(d);
    return {
      opacity: interpolate(ad, DRUM_OPACITY_STOPS.distance as unknown as number[], DRUM_OPACITY_STOPS.opacity as unknown as number[], Extrapolation.CLAMP),
      // the top edge of rows above the centre tilts away, the bottom edge of rows below does: a cylinder seen from the front
      transform: [
        { perspective: DRUM_PERSPECTIVE },
        { rotateX: `${Math.max(-DRUM_MAX_DEG, Math.min(DRUM_MAX_DEG, -d * DRUM_DEG_PER_ROW))}deg` },
        // same parabola as the side contours: row width at distance ad matches the contour's x at that height
        { scale: 1 - ((2 * cyl.bow) / cyl.rowW) * Math.min(1, (ad * ITEM_H) / cyl.half) ** 2 },
      ],
    };
  });
  const timeColor = useAnimatedStyle(() => {
    const ad = Math.abs((index * ITEM_H - scrollY.value) / ITEM_H);
    return { color: interpolateColor(ad, [0, 0.7], [focusColor, restColor]) };
  });
  const dotColor = open ? Availability.available : slot.state === 'blocked' ? Availability.blocked : slot.mine && slot.pending ? Availability.minePending : slot.mine ? Availability.mine : Availability.reserved;

  return (
    <Animated.View
      testID={`wheel-row-${slot.start}`}
      style={[
        s.row, drum,
        slot.state === 'reserved' && !slot.mine && s.rowReserved,
        slot.state === 'reserved' && slot.mine && !slot.pending && s.rowMine,
        slot.state === 'reserved' && slot.mine && slot.pending && s.rowPending,
        slot.state === 'blocked' && s.rowBlocked,
        isSelected && s.rowSelected,
      ]}>
      <View style={s.rowInner}>
        <View style={[s.dot, { backgroundColor: dotColor }]} />
        <Animated.Text testID={`wheel-time-${slot.start}`} style={[s.time, timeColor, !open && s.timeDisabled]} numberOfLines={1}>
          {fmtSlot(slot.start)}
        </Animated.Text>

        {/* Weather: only for bookable outdoor times, only when real data exists */}
        {wx ? (
          <View style={s.wxArea}>
            <WxIcon type={wx.iconType} size={18} />
            <Text style={s.temp}>{wx.temp}°F</Text>
            <Text style={s.cond} numberOfLines={1}>{wx.condition}</Text>
          </View>
        ) : (
          <View style={s.wxSpacer} />
        )}

        {open ? (
          <TouchableOpacity
            testID={`wheel-select-${slot.start}`}
            style={[s.btn, isSelected && s.btnActive]}
            onPress={() => onSelect(slot, index)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel(slot, isSelected)}
            accessibilityState={{ selected: isSelected }}
            hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}>
            <Text style={[s.btnLabel, isSelected && s.btnLabelActive]}>{isSelected ? '✓' : 'Select'}</Text>
          </TouchableOpacity>
        ) : (
          <View
            testID={`wheel-unavailable-${slot.start}`}
            accessible
            accessibilityLabel={a11yLabel(slot, false)}
            accessibilityState={{ disabled: true }}
            style={[s.statePill, slot.state === 'blocked' ? s.statePillBlocked : slot.mine && slot.pending ? s.statePillPending : slot.mine ? s.statePillMine : s.statePillReserved]}>
            <Text style={[s.statePillText, { color: slot.state === 'blocked' ? Availability.blocked : slot.mine && slot.pending ? Availability.minePending : slot.mine ? theme.textPrimary : theme.textMuted }]}>
              {slot.state === 'reserved' && slot.mine && slot.pending ? 'Pending' : slot.state === 'reserved' && slot.mine ? 'Yours' : slot.state === 'reserved' && slot.inside === false ? 'Overlaps' : STATE_LABEL[slot.state as 'reserved' | 'blocked' | 'limit']}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/**
 * A custom drum wheel (not the native iOS picker): the rows need weather, availability colours, disabled states and per-row
 * actions, which UIDatePicker cannot render. Curvature/fade run on the UI thread from the scroll offset (react-native-reanimated,
 * included in Expo Go). The centred row is only FOCUS; a time is booked-selected only through its Select button.
 * It fills the height its parent gives it, is the only vertical scroller in the sheet, and measures itself.
 */
export const TimeSlotWheel = memo(function TimeSlotWheel({
  slots: rawSlots, fill = false, selectedSlot, onSelectSlot,
  weather, outdoor, sheetDate, now, theme,
}: TimeSlotWheelProps) {
  const slots = useMemo<SlotInfo[]>(
    () => rawSlots.map((x) => (typeof x === 'string' ? { start: x, state: 'available' as const } : x)),
    [rawSlots],
  );
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const lastIdx = useSharedValue(-1);
  const [wheelH, setWheelH] = useState(WHEEL_H);
  const [wheelW, setWheelW] = useState(0);
  const s = useWheelStyles(theme);
  const boxH = fill ? wheelH : WHEEL_H;
  const cyl = useMemo(() => cylinderFor(wheelW || 340, boxH), [wheelW, boxH]);
  const pad = wheelPad(wheelH, ITEM_H);
  const starts = useMemo(() => slots.map((x) => x.start), [slots]);

  // Feedback: a subtle tick per meaningful centre change caused by the USER's finger; never for refreshes or programmatic scrolls.
  const gateRef = useRef<FeedbackGate>(newGate());
  const userDriven = useRef(false);
  const prefsRef = useRef(getPickerPrefs());
  useEffect(() => {
    void loadPickerPrefs().then((p) => { prefsRef.current = p; if (p.sound) warmPickerSound(); });
    return subscribePickerPrefs((p) => { prefsRef.current = p; if (p.sound) warmPickerSound(); });
  }, []);
  const onCentreChange = useCallback((idx: number) => {
    const d = decideFeedback(gateRef.current, idx, Date.now(), { userDriven: userDriven.current, ...prefsRef.current });
    gateRef.current = d.gate;
    if (d.haptic) hapticTick();
    if (d.sound) soundTick();
  }, []);

  const scrollToIndex = useCallback((idx: number, animated: boolean) => {
    userDriven.current = false;
    gateRef.current = { ...gateRef.current, lastIdx: idx };
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated });
  }, [scrollRef]);

  useEffect(() => {
    if (slots.length === 0) return;
    // Land on the selection, else the first bookable time, else the top. Only when the list or the height changes.
    const sel = selectedSlot ? starts.indexOf(selectedSlot) : -1;
    const firstOpen = slots.findIndex((x) => x.state === 'available');
    const target = sel >= 0 ? sel : Math.max(0, firstOpen);
    const tid = setTimeout(() => scrollToIndex(target, false), 60);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, wheelH]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const idx = centeredIndex(e.contentOffset.y, ITEM_H, slots.length);
      if (idx !== lastIdx.value) {
        lastIdx.value = idx;
        scheduleOnRN(onCentreChange, idx);
      }
    },
  });

  const handleSelect = useCallback(
    (slot: SlotInfo, idx: number) => {
      if (slot.state !== 'available') return; // disabled rows never select
      const next = slot.start === selectedSlot ? null : slot.start;
      onSelectSlot(next);
      if (next !== null) {
        if (prefsRef.current.haptics) hapticConfirm();
        scrollToIndex(idx, true);
      }
    },
    [selectedSlot, onSelectSlot, scrollToIndex],
  );

  return (
    <View
      style={[s.wheel, fill ? { flex: 1, minHeight: MIN_H } : { height: WHEEL_H, marginBottom: 12 }]}
      onLayout={(e) => {
        const { width: w, height: h0 } = e.nativeEvent.layout;
        const w1 = Math.round(w);
        if (w1 > 0 && Math.abs(w1 - wheelW) > 1) setWheelW(w1);
        const h = Math.round(h0);
        if (fill && h > 0 && Math.abs(h - wheelH) > 1) setWheelH(h);
      }}>
      {/* Fixed centre band: the focus indicator never moves; the drum rolls under it. */}
      <View pointerEvents="none" style={[s.band, { top: pad, height: ITEM_H }]} />
      <Animated.ScrollView
        ref={scrollRef}
        testID="time-slot-wheel"
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => { userDriven.current = true; }}
        onMomentumScrollBegin={() => { userDriven.current = true; }}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: pad }}>
        {slots.map((slot, i) => (
          <WheelRow
            key={slot.start}
            slot={slot}
            index={i}
            scrollY={scrollY}
            isSelected={slot.start === selectedSlot}
            wx={slot.state === 'available' && outdoor && weather ? wxForSlot(slot.start, sheetDate, now, weather) : null}
            theme={theme}
            s={s}
            onSelect={handleSelect}
            cyl={cyl}
          />
        ))}
      </Animated.ScrollView>
      {/* Selection band in front of the drum: tinted so the focused row reads through it, spanning the widest part */}
      <View pointerEvents="none" style={[s.bandFront, { top: pad, height: ITEM_H }]} />
      {/* Cylinder silhouette: static vector (the drum shape never moves, rows roll inside it), so no per-frame work */}
      {wheelW > 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={wheelW - 2} height={boxH - 2}>
            <Path d={contourPath(wheelW - 2, boxH - 2, cyl.bow, 'left')} stroke={theme.textMuted} strokeOpacity={0.4} strokeWidth={1} fill="none" strokeLinecap="round" />
            <Path d={contourPath(wheelW - 2, boxH - 2, cyl.bow, 'right')} stroke={theme.textMuted} strokeOpacity={0.4} strokeWidth={1} fill="none" strokeLinecap="round" />
          </Svg>
        </View>
      ) : null}
      {/* Soft top/bottom fade so the wheel reads as continuous, not clipped */}
      <FadeMask position="top" color={theme.sheetBg} height={Math.min(ITEM_H * 1.5, Math.max(ITEM_H, pad * 0.5))} />
      <FadeMask position="bottom" color={theme.sheetBg} height={Math.min(ITEM_H * 1.5, Math.max(ITEM_H, pad * 0.5))} />
    </View>
  );
});

function FadeMask({ position, color, height }: { position: 'top' | 'bottom'; color: string; height: number }) {
  const id = `fade-${position}`;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, height, [position]: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={position === 'top' ? 0.7 : 0} />
            <Stop offset="1" stopColor={color} stopOpacity={position === 'top' ? 0 : 0.7} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

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
      band: {
        position: 'absolute', left: 6, right: 6, borderRadius: Radius.sm,
        backgroundColor: theme.surface2, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      },
      bandFront: {
        position: 'absolute', left: 2, right: 2, borderRadius: Radius.sm,
        backgroundColor: 'rgba(45,107,255,0.04)', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(45,107,255,0.35)',
      },
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
      timeDisabled: { color: theme.textMuted, textDecorationLine: 'line-through' },
      wxArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
      wxSpacer: { flex: 1 },
      temp: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textMuted, minWidth: 34 },
      cond: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textMuted, flexShrink: 1 },
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
