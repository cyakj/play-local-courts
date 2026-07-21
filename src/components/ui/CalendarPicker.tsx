import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Colors, FontFamily, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// "Today" / "Tomorrow" / weekday-month-day — shared label logic for the date
// row that sits above this calendar (see courts.tsx, match/new.tsx).
export function formatDateLabel(date: Date, now: Date): string {
  if (date.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function CalendarPicker({
  selectedDate,
  onSelect,
  minDate,
  maxDate,
  theme,
  testID,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  minDate: Date;
  maxDate: Date;
  theme: ThemeTokens;
  testID?: string;
}) {
  // Single state object avoids two-setter batching issues (React bails out when
  // one value is unchanged, which can drop the paired update in the same flush).
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const init = selectedDate < minDate ? minDate : selectedDate > maxDate ? maxDate : selectedDate;
    return { year: init.getFullYear(), month: init.getMonth() };
  });
  const { year: viewYear, month: viewMonth } = view;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();

  const minMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const maxMonthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

  // Compare milliseconds to avoid object-reference issues
  const canGoPrev = new Date(viewYear, viewMonth, 1) > minMonthStart;
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxMonthEnd;

  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = chunkArray(cells, 7);

  const s = useMemo(() => ({
    wrap: {
      backgroundColor: theme.surface2,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      marginBottom: 8,
    } as const,
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 10,
    } as const,
    monthText: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 15,
      color: theme.textPrimary,
    } as const,
    navBtn: {
      width: 32,
      height: 32,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: Radius.sm,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.border,
    } as const,
    dayHeaders: { flexDirection: 'row' as const, marginBottom: 4 } as const,
    dayHeaderCell: { flex: 1, alignItems: 'center' as const } as const,
    dayHeaderText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
      letterSpacing: 0.4,
    } as const,
    row: { flexDirection: 'row' as const, marginBottom: 2 } as const,
    cell: {
      flex: 1,
      height: 36,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: Radius.sm,
    } as const,
    cellSelected: { backgroundColor: Colors.blue } as const,
    cellToday: { borderWidth: 1, borderColor: theme.cyanOnLight } as const,
    cellText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 13,
      color: theme.textSecondary,
    } as const,
    cellTextSelected: { color: Colors.white, fontFamily: FontFamily.manropeBold } as const,
    cellTextToday: { color: theme.cyanOnLight } as const,
    cellTextDisabled: { color: theme.textMuted, opacity: 0.4 } as const,
  }), [theme]);

  return (
    <View style={s.wrap} testID={testID ?? 'calendar-picker'}>
      <View style={s.header}>
        <TouchableOpacity
          style={[s.navBtn, !canGoPrev && { opacity: 0.3 }]}
          onPress={() => {
            // Functional updater guarantees latest state, not a stale closure value.
            setView(cur => {
              const d = new Date(cur.year, cur.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            });
          }}
          disabled={!canGoPrev}
          activeOpacity={0.7}
          testID="cal-prev-month">
          <ChevronLeft color={theme.textSecondary} size={16} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={s.monthText}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity
          style={[s.navBtn, !canGoNext && { opacity: 0.3 }]}
          onPress={() => {
            setView(cur => {
              const d = new Date(cur.year, cur.month + 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            });
          }}
          disabled={!canGoNext}
          activeOpacity={0.7}
          testID="cal-next-month">
          <ChevronRight color={theme.textSecondary} size={16} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <View style={s.dayHeaders}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={s.dayHeaderCell}>
            <Text style={s.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={s.row}>
          {row.map((day, colIdx) => {
            if (!day) return <View key={colIdx} style={s.cell} />;
            const cellDate = new Date(viewYear, viewMonth, day);
            cellDate.setHours(0, 0, 0, 0);
            const checkMin = new Date(minDate); checkMin.setHours(0, 0, 0, 0);
            const checkMax = new Date(maxDate); checkMax.setHours(0, 0, 0, 0);
            const isDisabled = cellDate < checkMin || cellDate > checkMax;
            const isSelected = cellDate.toDateString() === selectedDate.toDateString();
            const isToday = cellDate.toDateString() === today.toDateString();
            return (
              <TouchableOpacity
                key={colIdx}
                testID={`cal-day-${day}`}
                style={[
                  s.cell,
                  isSelected && s.cellSelected,
                  !isSelected && isToday && s.cellToday,
                  isDisabled && { opacity: 0.25 },
                ]}
                onPress={() => { if (!isDisabled) onSelect(cellDate); }}
                disabled={isDisabled}
                activeOpacity={0.7}>
                <Text style={[
                  s.cellText,
                  isSelected && s.cellTextSelected,
                  !isSelected && isToday && s.cellTextToday,
                  isDisabled && s.cellTextDisabled,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
