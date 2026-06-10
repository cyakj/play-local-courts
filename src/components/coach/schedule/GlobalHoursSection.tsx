import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachGlobalHour } from '@/types/coachSchedule';
import { DAY_NAMES, formatTime } from '@/types/coachSchedule';
import { SectionCard } from './SectionCard';
import { ChoiceChips, ScheduleEntrySheet, ScheduleField } from './ScheduleEntrySheet';

interface Props {
  values: CoachGlobalHour[];
  coachId: string;
  onChange: (values: CoachGlobalHour[]) => void;
}

export function GlobalHoursSection({ values, coachId, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [editing, setEditing] = useState<CoachGlobalHour | null>(null);

  const rows = DAY_NAMES.map((_, day) => values.find(item => item.day_of_week === day) ?? {
    id: `draft-global-${day}`,
    coach_id: coachId,
    day_of_week: day,
    start_time: '07:00',
    end_time: '20:00',
    is_closed: true,
  });

  function apply() {
    if (!editing) return;
    onChange([...values.filter(item => item.day_of_week !== editing.day_of_week), editing]
      .sort((a, b) => a.day_of_week - b.day_of_week));
    setEditing(null);
  }

  return (
    <>
      <SectionCard
        title="Coaching Boundaries"
        description="Private outer boundaries for when you are generally willing to coach.">
        <View style={styles.list}>
          {rows.map(row => (
            <TouchableOpacity
              key={row.day_of_week}
              style={styles.row}
              onPress={() => setEditing({ ...row })}
              activeOpacity={0.75}>
              <View style={[styles.statusDot, row.is_closed ? styles.closedDot : styles.openDot]} />
              <Text style={styles.day}>{DAY_NAMES[row.day_of_week]}</Text>
              <Text style={[styles.time, row.is_closed && styles.closedText]}>
                {row.is_closed ? 'Inactive' : `${formatTime(row.start_time)} - ${formatTime(row.end_time)}`}
              </Text>
              <Clock3 size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      <ScheduleEntrySheet
        visible={!!editing}
        title={editing ? DAY_NAMES[editing.day_of_week] : 'Coaching Boundary'}
        onCancel={() => setEditing(null)}
        onSave={apply}
        saveDisabled={!editing || (!editing.is_closed && editing.start_time >= editing.end_time)}>
        {editing && (
          <>
            <ChoiceChips
              label="STATUS"
              value={editing.is_closed ? 'inactive' : 'active'}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              onChange={value => setEditing({ ...editing, is_closed: value === 'inactive' })}
            />
            {!editing.is_closed && (
              <>
                <ScheduleField
                  label="START TIME"
                  value={editing.start_time}
                  onChangeText={start_time => setEditing({ ...editing, start_time })}
                  placeholder="07:00"
                />
                <ScheduleField
                  label="END TIME"
                  value={editing.end_time}
                  onChangeText={end_time => setEditing({ ...editing, end_time })}
                  placeholder="20:00"
                />
              </>
            )}
            <Text style={styles.helper}>Use 24-hour HH:MM format. Coaching boundaries remain internal in this control panel.</Text>
          </>
        )}
      </ScheduleEntrySheet>
    </>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    list: { gap: 8 },
    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      backgroundColor: theme.inputBg,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    openDot: { backgroundColor: Colors.positive },
    closedDot: { backgroundColor: theme.textDisabled },
    day: {
      width: 82,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    time: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      textAlign: 'right',
    },
    closedText: { color: theme.textMuted },
    helper: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
    },
  }), [theme]);
}
