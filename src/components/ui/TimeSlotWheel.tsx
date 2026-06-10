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
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Colors, FontFamily, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Wheel dimensions ─────────────────────────────────────────────────────────

const ITEM_H  = 52;
const VISIBLE = 7;
const WHEEL_H = ITEM_H * VISIBLE;          // 364
const PAD     = (WHEEL_H - ITEM_H) / 2;   // 156 — centers first/last items

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
  slots: string[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
  weather: WheelWeatherSource | null;
  outdoor: boolean;
  isOutdoorSlot?: (slot: string) => boolean;
  showWeatherFallback?: boolean;
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

function wxForSlot(slot: string, date: Date, now: Date, wx: WheelWeatherSource): SlotWx {
  const hour = parseInt(slot.split(':')[0], 10);
  const idx  = hourlyIdx(date, hour, now);
  const temp = idx < wx.hourlyTemp.length ? Math.round(wx.hourlyTemp[idx] ?? wx.tempF) : Math.round(wx.tempF);
  const rain = idx < wx.hourlyRain.length ? (wx.hourlyRain[idx] ?? wx.rainPct) : wx.rainPct;

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

export const TimeSlotWheel = memo(function TimeSlotWheel({
  slots, selectedSlot, onSelectSlot,
  weather, outdoor, isOutdoorSlot, showWeatherFallback = false, sheetDate, now, theme,
}: TimeSlotWheelProps) {
  const scrollRef  = useRef<ScrollView>(null);
  const lastIdxRef = useRef(0);
  const [centeredIdx, setCenteredIdx] = useState(0);
  const s = useWheelStyles(theme);

  useEffect(() => {
    if (slots.length === 0) return;
    const target = selectedSlot ? Math.max(0, slots.indexOf(selectedSlot)) : 0;
    lastIdxRef.current = target;
    setCenteredIdx(target);
    const tid = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: target * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

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
    (slot: string, idx: number) => {
      const next = slot === selectedSlot ? null : slot;
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
    <View style={[s.wheel, { height: WHEEL_H }]}>
      <ScrollView
        ref={scrollRef}
        testID="time-slot-wheel"
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {slots.map((slot, i) => {
          const dist       = Math.abs(i - centeredIdx);
          const isCentered = i === centeredIdx;
          const isSelected = slot === selectedSlot;
          const { scaleY, opacity } = cylT(dist);
          const slotIsOutdoor = isOutdoorSlot ? isOutdoorSlot(slot) : outdoor;
          const wx = slotIsOutdoor && weather ? wxForSlot(slot, sheetDate, now, weather) : null;

          return (
            <View
              key={slot}
              testID={`wheel-row-${slot}`}
              style={[
                s.row,
                { opacity },
                isCentered && s.rowFocused,
                isSelected && s.rowSelected,
              ]}
            >
              {/* Inner view receives the scaleY cylinder transform */}
              <View style={[s.rowInner, { transform: [{ scaleY }] }]}>
                {/* Time */}
                <Text
                  testID={`wheel-time-${slot}`}
                  style={[s.time, isCentered && s.timeFocused]}
                  numberOfLines={1}
                >
                  {fmtSlot(slot)}
                </Text>

                {/* Weather (outdoor courts only) */}
                {slotIsOutdoor && wx ? (
                  <View style={s.wxArea}>
                    <WxIcon type={wx.iconType} size={isCentered ? 20 : 18} />
                    <Text style={[s.temp, isCentered && s.tempFocused]}>{wx.temp}°F</Text>
                    <Text style={[s.cond, isCentered && s.condFocused]} numberOfLines={1}>
                      {wx.condition}
                    </Text>
                  </View>
                ) : slotIsOutdoor && showWeatherFallback ? (
                  <View style={s.wxArea}>
                    <Text style={[s.weatherFallback, isCentered && s.condFocused]} numberOfLines={1}>
                      Weather unavailable
                    </Text>
                  </View>
                ) : (
                  <View style={s.wxSpacer} />
                )}

                {/* Select / ✓ button */}
                <TouchableOpacity
                  testID={`wheel-select-${slot}`}
                  style={[s.btn, isSelected && s.btnActive]}
                  onPress={() => handleSelect(slot, i)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[s.btnLabel, isSelected && s.btnLabelActive]}>
                    {isSelected ? '✓' : 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

function useWheelStyles(theme: ThemeTokens) {
  return useMemo(() => {
    const selBlue   = Colors.blue;
    const selBlueBg = 'rgba(45,107,255,0.09)';

    return StyleSheet.create({
      wheel: {
        overflow: 'hidden',
        borderRadius: Radius.card,
        backgroundColor: theme.sheetBg,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 12,
      },

      // Full layout-height container — occupies ITEM_H; no background
      row: {
        height: ITEM_H,
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: Radius.sm,
        marginHorizontal: 4,
      },
      // Blue border when this row is the centered/focused one
      rowFocused: {
        borderColor: selBlue,
        backgroundColor: selBlueBg,
      },
      // Extra: slightly stronger border when user has tapped Select
      rowSelected: {
        borderColor: selBlue,
        backgroundColor: selBlueBg,
      },

      // The inner view gets the scaleY cylinder transform — this is what
      // creates the "rows curving away from the viewer" illusion.
      rowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        gap: 8,
      },

      time: {
        fontFamily: FontFamily.manropeSemiBold,
        fontSize: 15,
        color: theme.textMuted,
        letterSpacing: 0,
        width: 80,
      },
      timeFocused: {
        color: theme.textPrimary,
        fontFamily: FontFamily.manropeBold,
      },

      wxArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        overflow: 'hidden',
      },
      wxSpacer: { flex: 1 },

      temp: {
        fontFamily: FontFamily.manropeSemiBold,
        fontSize: 13,
        color: theme.textMuted,
        minWidth: 34,
      },
      tempFocused: {
        color: Colors.blue,
      },

      cond: {
        fontFamily: FontFamily.manropeMedium,
        fontSize: 13,
        color: theme.textMuted,
        flexShrink: 1,
      },
      condFocused: {
        color: theme.textSecondary,
      },
      weatherFallback: {
        fontFamily: FontFamily.manropeMedium,
        fontSize: 12,
        color: theme.textMuted,
        flexShrink: 1,
      },

      btn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface2,
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
      },
      btnActive: {
        backgroundColor: selBlue,
        borderColor: selBlue,
      },
      btnLabel: {
        fontFamily: FontFamily.manropeSemiBold,
        fontSize: 12,
        color: theme.textMuted,
      },
      btnLabelActive: {
        color: '#FFFFFF',
      },
    });
  }, [theme]);
}
