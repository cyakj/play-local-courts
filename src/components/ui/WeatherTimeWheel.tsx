import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudSun,
  Droplets,
  Sun,
  Wind,
} from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import {
  computeWeatherScore,
  WEATHER_SCORE_COLORS,
  useHourlyWeather,
  type WeatherScore,
} from '@/hooks/useHourlyWeather';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_COL_W_OUTDOOR = 80;
const DAY_COL_W_INDOOR = 64;
const DAY_COL_H_OUTDOOR = 88;
const DAY_COL_H_INDOOR = 64;
const WEATHER_WINDOW_DAYS = 7;
const MS_PER_DAY = 86_400_000;

const SUN_AMBER = '#F59E0B';
const CLOUD_SLATE = '#94A3B8';
const RAIN_BLUE = '#93C5FD';

// Fixed slot row dimensions for getItemLayout (enables reliable scrollToIndex)
const SLOT_H   = Spacing.listRowHeight; // 56px — minHeight of each row
const SLOT_GAP = Spacing.s2;            // 8px  — gap between rows

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeatherTimeWheelProps {
  availableDates: Date[];
  onSelectSlot: (date: Date, time: string, durationMinutes: number) => void;
  theme: ThemeTokens;
  mode?: 'outdoor' | 'indoor';
  bookedSlots?: { date: string; time: string }[];
  slotIntervalMinutes?: number;
  slotStartHour?: number;
  slotEndHour?: number;
  allowedDurations?: number[];
  defaultDurationMinutes?: number;
  locationCity?: string;
  unavailableDates?: Date[];
  selectedDate?: Date;
  selectedTime?: string | null;
  selectedDuration?: number;
  onDateChange?: (date: Date) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAhead(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / MS_PER_DAY);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatSlotDisplay(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const ampm = (h ?? 0) < 12 ? 'AM' : 'PM';
  const display = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${display}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

function formatDayName(date: Date): string {
  if (daysAhead(date) === 0) return 'TODAY';
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = minutes / 60;
  return hrs === Math.floor(hrs) ? `${hrs} hr` : `${hrs} hr`;
}

function rainToIconType(rainPct: number): 'sun' | 'cloud' | 'rain' | 'storm' {
  if (rainPct >= 70) return 'storm';
  if (rainPct >= 40) return 'rain';
  if (rainPct >= 15) return 'cloud';
  return 'sun';
}

// ─── Weather icon ─────────────────────────────────────────────────────────────

function WxIcon({ rainPct, size }: { rainPct: number; size: number }) {
  const type = rainToIconType(rainPct);
  if (type === 'storm') return <CloudLightning size={size} color={RAIN_BLUE} strokeWidth={1.5} />;
  if (type === 'rain')  return <CloudRain size={size} color={RAIN_BLUE} strokeWidth={1.5} />;
  if (type === 'cloud') return <CloudSun size={size} color={CLOUD_SLATE} strokeWidth={1.5} />;
  return <Sun size={size} color={SUN_AMBER} strokeWidth={1.5} />;
}

// ─── DayColumn ────────────────────────────────────────────────────────────────

interface DayColumnProps {
  date: Date;
  isSelected: boolean;
  isUnavailable: boolean;
  mode: 'outdoor' | 'indoor';
  rainPct: number | null;
  tempF: number | null;
  windMph: number | null;
  score: WeatherScore | null;
  hasWeather: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}

const DayColumn = memo(function DayColumn({
  date, isSelected, isUnavailable, mode,
  rainPct, tempF, score, hasWeather,
  onPress, theme,
}: DayColumnProps) {
  const colW = mode === 'outdoor' ? DAY_COL_W_OUTDOOR : DAY_COL_W_INDOOR;
  const colH = mode === 'outdoor' ? DAY_COL_H_OUTDOOR : DAY_COL_H_INDOOR;
  const showNoForecast = mode === 'outdoor' && !hasWeather;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isUnavailable}
      activeOpacity={0.7}
      style={[
        styles.dayCol,
        {
          width: colW,
          minHeight: colH,
          borderColor: isSelected ? Colors.blue : theme.border,
          backgroundColor: isSelected ? Colors.blue : theme.cardBg,
          opacity: isUnavailable ? 0.35 : 1,
        },
      ]}
    >
      <Text style={[styles.dayName, { color: isSelected ? '#FFFFFF' : theme.textMuted }]}>
        {formatDayName(date)}
      </Text>
      <Text style={[styles.dayDate, { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>
        {formatDateShort(date)}
      </Text>

      {mode === 'outdoor' && (
        hasWeather && rainPct !== null && tempF !== null ? (
          <>
            <WxIcon rainPct={rainPct} size={18} />
            <Text style={[styles.dayTemp, { color: isSelected ? '#FFFFFF' : theme.textSecondary }]}>
              {tempF}°F
            </Text>
            {score !== null && (
              <View style={[styles.scoreDot, { backgroundColor: WEATHER_SCORE_COLORS[score] }]} />
            )}
          </>
        ) : showNoForecast ? (
          <CloudOff size={14} color={theme.textDisabled} strokeWidth={1.5} />
        ) : null
      )}
    </TouchableOpacity>
  );
});

// ─── SlotRow ──────────────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: string;
  isSelected: boolean;
  isBooked: boolean;
  mode: 'outdoor' | 'indoor';
  rainPct: number | null;
  tempF: number | null;
  windMph: number | null;
  showWeather: boolean;
  score: WeatherScore | null;
  onPress: () => void;
  theme: ThemeTokens;
}

const SlotRow = memo(function SlotRow({
  slot, isSelected, isBooked, mode,
  rainPct, tempF, windMph,
  showWeather, score, onPress, theme,
}: SlotRowProps) {
  const scoreColor = score ? WEATHER_SCORE_COLORS[score] : null;
  const showWxData = mode === 'outdoor' && showWeather && !isBooked && rainPct !== null;
  const textColor = isBooked ? theme.textDisabled : isSelected ? '#FFFFFF' : theme.textPrimary;
  const dimColor  = isSelected ? 'rgba(255,255,255,0.65)' : theme.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isBooked}
      activeOpacity={0.75}
      style={[
        styles.slotRow,
        {
          borderColor: isSelected ? Colors.blue : theme.border,
          backgroundColor: isBooked ? theme.bgElevated : isSelected ? Colors.blue : theme.cardBg,
          borderLeftColor: !isBooked && !isSelected && scoreColor ? scoreColor : isSelected ? Colors.blue : theme.border,
          borderLeftWidth: !isBooked && !isSelected && scoreColor ? 3 : 1,
        },
      ]}
    >
      <Text
        style={[styles.slotTime, { color: textColor, textDecorationLine: isBooked ? 'line-through' : 'none' }]}
      >
        {formatSlotDisplay(slot)}
      </Text>

      {showWxData && tempF !== null && windMph !== null && (
        <View style={styles.slotWxRow}>
          <WxIcon rainPct={rainPct ?? 0} size={13} />
          <Text style={[styles.slotWxText, { color: dimColor }]}>{tempF}°F</Text>
          <Droplets size={11} color={isSelected ? 'rgba(255,255,255,0.7)' : RAIN_BLUE} strokeWidth={1.5} />
          <Text style={[styles.slotWxText, { color: dimColor }]}>{rainPct}%</Text>
          <Wind size={11} color={isSelected ? 'rgba(255,255,255,0.7)' : CLOUD_SLATE} strokeWidth={1.5} />
          <Text style={[styles.slotWxText, { color: dimColor }]}>{windMph} mph</Text>
        </View>
      )}

      {isBooked && (
        <Text style={[styles.slotBooked, { color: theme.textDisabled }]}>Booked</Text>
      )}

      {!isBooked && score && mode === 'outdoor' && showWeather && scoreColor && (
        <View style={[styles.scorePill, { backgroundColor: `${scoreColor}22`, borderColor: `${scoreColor}55` }]}>
          <Text style={[styles.scorePillText, { color: scoreColor }]}>{score}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─── SlotSeparator ────────────────────────────────────────────────────────────

function SlotSeparator() {
  return <View style={{ height: SLOT_GAP }} />;
}

// ─── DurationSelector ─────────────────────────────────────────────────────────

interface DurationSelectorProps {
  durations: number[];
  selected: number;
  onSelect: (d: number) => void;
  theme: ThemeTokens;
}

const DurationSelector = memo(function DurationSelector({
  durations, selected, onSelect, theme,
}: DurationSelectorProps) {
  return (
    <View style={styles.durationSection}>
      <Text style={[styles.durationLabel, { color: theme.textMuted }]}>DURATION</Text>
      <View style={styles.durationRow}>
        {durations.map((d) => {
          const isActive = d === selected;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => onSelect(d)}
              activeOpacity={0.7}
              style={[
                styles.durationPill,
                {
                  borderColor: isActive ? Colors.blue : theme.border,
                  backgroundColor: isActive ? Colors.blue : theme.surface2,
                },
              ]}
            >
              <Text
                style={[
                  styles.durationText,
                  { color: isActive ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                {formatDuration(d)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

// ─── WeatherTimeWheel ─────────────────────────────────────────────────────────

export const WeatherTimeWheel = memo(function WeatherTimeWheel({
  availableDates,
  onSelectSlot,
  theme,
  mode = 'outdoor',
  bookedSlots = [],
  slotIntervalMinutes = 30,
  slotStartHour = 6,
  slotEndHour = 22,
  allowedDurations = [60, 90, 120],
  defaultDurationMinutes,
  locationCity,
  unavailableDates = [],
  selectedDate: controlledDate,
  selectedTime: controlledTime,
  selectedDuration: controlledDuration,
  onDateChange,
}: WeatherTimeWheelProps) {
  const slotListRef = useRef<FlatList<string>>(null);

  const [internalDate, setInternalDate] = useState<Date>(availableDates[0] ?? new Date());
  const [internalTime, setInternalTime] = useState<string | null>(null);
  const [internalDuration, setInternalDuration] = useState<number>(
    defaultDurationMinutes ?? allowedDurations[0] ?? 60,
  );

  const activeDate = controlledDate ?? internalDate;
  const activeTime = controlledTime !== undefined ? controlledTime : internalTime;
  const activeDuration = controlledDuration ?? internalDuration;

  const { getWeather } = useHourlyWeather(mode === 'outdoor' ? (locationCity ?? null) : null);

  const withinWindow = useCallback((date: Date) => daysAhead(date) <= WEATHER_WINDOW_DAYS, []);

  const slots = useMemo(() => {
    const list: string[] = [];
    for (let h = slotStartHour; h < slotEndHour; h++) {
      for (let m = 0; m < 60; m += slotIntervalMinutes) {
        list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return list;
  }, [slotStartHour, slotEndHour, slotIntervalMinutes]);

  const bookedSet = useMemo(() => {
    const key = formatDateKey(activeDate);
    return new Set(
      bookedSlots.filter((b) => b.date === key).map((b) => b.time),
    );
  }, [bookedSlots, activeDate]);

  const unavailSet = useMemo(
    () => new Set(unavailableDates.map(formatDateKey)),
    [unavailableDates],
  );

  const handleDayPress = useCallback((date: Date) => {
    setInternalDate(date);
    setInternalTime(null);
    onDateChange?.(date);
  }, [onDateChange]);

  const handleSlotPress = useCallback((slot: string, currentDate: Date, currentDuration: number) => {
    setInternalTime(slot);
    onSelectSlot(currentDate, slot, currentDuration);
  }, [onSelectSlot]);

  const handleDurationSelect = useCallback((d: number, currentDate: Date, currentTime: string | null) => {
    setInternalDuration(d);
    if (currentTime) {
      onSelectSlot(currentDate, currentTime, d);
    }
  }, [onSelectSlot]);

  const getDayWeather = useCallback((date: Date) => {
    if (mode !== 'outdoor' || !withinWindow(date)) return null;
    return getWeather(date, '12:00');
  }, [getWeather, withinWindow, mode]);

  const getSlotWeather = useCallback((slot: string, date: Date) => {
    if (mode !== 'outdoor' || !withinWindow(date)) return null;
    const hour = parseInt(slot.split(':')[0] ?? '0', 10);
    return getWeather(date, `${String(hour).padStart(2, '0')}:00`);
  }, [getWeather, withinWindow, mode]);

  const showWeatherForActiveDay = mode === 'outdoor' && withinWindow(activeDate);

  // Scroll selected slot to center whenever it changes
  useEffect(() => {
    if (!activeTime) return;
    const index = slots.indexOf(activeTime);
    if (index < 0) return;
    const timer = setTimeout(() => {
      slotListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [activeTime, slots]);

  const getSlotItemLayout = useCallback((_: unknown, index: number) => ({
    length: SLOT_H,
    offset: (SLOT_H + SLOT_GAP) * index,
    index,
  }), []);

  const renderSlotItem = useCallback(({ item: slot }: { item: string }) => {
    const wx = getSlotWeather(slot, activeDate);
    const score = wx ? computeWeatherScore(wx.precipitationProbability, wx.windSpeed ?? 0) : null;
    return (
      <SlotRow
        slot={slot}
        isSelected={slot === activeTime}
        isBooked={bookedSet.has(slot)}
        mode={mode}
        rainPct={wx?.precipitationProbability ?? null}
        tempF={wx?.temperature ?? null}
        windMph={wx?.windSpeed ?? null}
        showWeather={showWeatherForActiveDay}
        score={score}
        onPress={() => handleSlotPress(slot, activeDate, activeDuration)}
        theme={theme}
      />
    );
  }, [
    getSlotWeather, activeDate, activeTime, bookedSet,
    mode, showWeatherForActiveDay, handleSlotPress, activeDuration, theme,
  ]);

  return (
    <View style={styles.root}>
      {/* Day strip */}
      <FlatList
        horizontal
        data={availableDates}
        keyExtractor={(d) => formatDateKey(d)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayStrip}
        style={styles.dayStripList}
        renderItem={({ item: date }) => {
          const wx = getDayWeather(date);
          const hasWx = wx !== null;
          const score = hasWx ? computeWeatherScore(wx.precipitationProbability, wx.windSpeed ?? 0) : null;
          return (
            <DayColumn
              date={date}
              isSelected={isSameDay(date, activeDate)}
              isUnavailable={unavailSet.has(formatDateKey(date))}
              mode={mode}
              rainPct={wx?.precipitationProbability ?? null}
              tempF={wx?.temperature ?? null}
              windMph={wx?.windSpeed ?? null}
              score={score}
              hasWeather={hasWx}
              onPress={() => handleDayPress(date)}
              theme={theme}
            />
          );
        }}
      />

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Slot list — flex: 1 bounds height so the list scrolls, not the parent */}
      <FlatList
        ref={slotListRef}
        data={slots}
        keyExtractor={(slot) => slot}
        renderItem={renderSlotItem}
        getItemLayout={getSlotItemLayout}
        ItemSeparatorComponent={SlotSeparator}
        extraData={{ activeTime, showWeatherForActiveDay }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.slotList}
        style={styles.slotListContainer}
        onScrollToIndexFailed={(info) => {
          slotListRef.current?.scrollToOffset({
            offset: (SLOT_H + SLOT_GAP) * info.index,
            animated: true,
          });
        }}
      />

      {/* Duration selector */}
      <View style={[styles.durationWrapper, { borderTopColor: theme.border }]}>
        <DurationSelector
          durations={allowedDurations}
          selected={activeDuration}
          onSelect={(d) => handleDurationSelect(d, activeDate, activeTime ?? null)}
          theme={theme}
        />
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Day strip
  dayStripList: {
    flexGrow: 0,
  },
  dayStrip: {
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: Spacing.s3,
    gap: Spacing.s2,
  },
  dayCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.s3,
    paddingHorizontal: Spacing.s1,
    borderRadius: Radius.card,
    borderWidth: 1,
    gap: 4,
  },
  dayName: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    letterSpacing: 0.1,
  },
  dayDate: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: 11,
  },
  dayTemp: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: Spacing.pagePx,
    marginBottom: Spacing.s2,
  },

  // Slot list
  slotListContainer: {
    flex: 1, // critical — bounds height so parent never scrolls
  },
  slotList: {
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: Spacing.s4,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap', // single line — enables fixed getItemLayout height
    minHeight: Spacing.listRowHeight,
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s3,
    gap: Spacing.s2,
    overflow: 'hidden',
  },
  slotTime: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.uiLabel,
    minWidth: 68,
    flexShrink: 0,
  },
  slotWxRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    gap: 4,
  },
  slotWxText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.metadata,
    flexShrink: 1,
  },
  slotBooked: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    letterSpacing: 0.1,
  },

  // WeatherScore pill
  scorePill: {
    paddingHorizontal: Spacing.s2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  scorePillText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    letterSpacing: 0.08,
  },

  // Duration selector
  durationWrapper: {
    borderTopWidth: 1,
  },
  durationSection: {
    paddingHorizontal: Spacing.pagePx,
    paddingTop: Spacing.s4,
    paddingBottom: Spacing.s4,
    gap: Spacing.s3,
  },
  durationLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    letterSpacing: 0.18,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s2,
  },
  durationPill: {
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s2,
    borderRadius: Radius.chip,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },
});
