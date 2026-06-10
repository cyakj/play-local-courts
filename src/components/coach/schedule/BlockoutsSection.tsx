import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ban, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { BlockoutType, CoachBlockout } from '@/types/coachSchedule';
import { createDraftId, formatDays, formatTime } from '@/types/coachSchedule';
import { SectionCard } from './SectionCard';
import {
  ChoiceChips,
  DayPicker,
  ScheduleEntrySheet,
  ScheduleField,
} from './ScheduleEntrySheet';

interface Props {
  values: CoachBlockout[];
  coachId: string;
  onChange: (values: CoachBlockout[]) => void;
}

const TYPE_OPTIONS: { value: BlockoutType; label: string }[] = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'personal', label: 'Personal' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'facility_unavailable', label: 'Facility unavailable' },
  { value: 'travel_time', label: 'Travel time' },
  { value: 'other', label: 'Other' },
];

function emptyRecord(coachId: string): CoachBlockout {
  return {
    id: createDraftId('blockout'),
    coach_id: coachId,
    type: 'personal',
    title: null,
    days_of_week: [1],
    start_time: '12:00',
    end_time: '13:00',
    specific_date: null,
    visibility: 'show_as_unavailable',
  };
}

export function BlockoutsSection({ values, coachId, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [editing, setEditing] = useState<CoachBlockout | null>(null);
  const [pattern, setPattern] = useState<'recurring' | 'date'>('recurring');

  function beginEdit(record: CoachBlockout) {
    setEditing({ ...record });
    setPattern(record.specific_date ? 'date' : 'recurring');
  }

  function apply() {
    if (!editing) return;
    const normalized = pattern === 'date'
      ? { ...editing, days_of_week: null, visibility: 'show_as_unavailable' as const }
      : { ...editing, specific_date: null, visibility: 'show_as_unavailable' as const };
    onChange([...values.filter(item => item.id !== editing.id), normalized]);
    setEditing(null);
  }

  return (
    <>
      <SectionCard
        title="Unavailable Times"
        description="These times are removed from your bookable schedule. Players will only see you as unavailable."
        action={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => { setPattern('recurring'); setEditing(emptyRecord(coachId)); }}
            activeOpacity={0.8}>
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }>
        {values.length === 0 ? (
          <Text style={styles.empty}>No unavailable times in this draft.</Text>
        ) : values.map(record => (
          <View key={record.id} style={styles.entry}>
            <View style={styles.entryIcon}>
              <Ban size={18} color={theme.textSecondary} />
              <Text style={styles.entryCode}>B</Text>
            </View>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>
                {TYPE_OPTIONS.find(option => option.value === record.type)?.label ?? 'Blockout'}
              </Text>
              {!!record.title && <Text style={styles.entryReason}>{record.title}</Text>}
              <Text style={styles.entryMeta}>
                {record.specific_date ?? formatDays(record.days_of_week)}
              </Text>
              <Text style={styles.entryMeta}>{formatTime(record.start_time)} - {formatTime(record.end_time)}</Text>
              <Text style={styles.unavailableLabel}>UNAVAILABLE TO PLAYERS</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => beginEdit(record)}>
                <Pencil size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => onChange(values.filter(item => item.id !== record.id))}>
                <Trash2 size={16} color={Colors.negative} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </SectionCard>

      <ScheduleEntrySheet
        visible={!!editing}
        title={editing && !editing.id.startsWith('draft-')
          ? 'Edit Unavailable Time'
          : 'Add Unavailable Time'}
        onCancel={() => setEditing(null)}
        onSave={apply}
        saveDisabled={
          !editing ||
          editing.start_time != null && editing.end_time != null && editing.start_time >= editing.end_time ||
          pattern === 'recurring' && !editing.days_of_week?.length ||
          pattern === 'date' && !editing.specific_date
        }>
        {editing && (
          <>
            <ChoiceChips label="TYPE" value={editing.type} options={TYPE_OPTIONS} onChange={type => setEditing({ ...editing, type })} />
            <ChoiceChips
              label="PATTERN"
              value={pattern}
              options={[
                { value: 'recurring', label: 'Recurring days' },
                { value: 'date', label: 'Specific date' },
              ]}
              onChange={setPattern}
            />
            {pattern === 'recurring' ? (
              <DayPicker
                selected={editing.days_of_week ?? []}
                onChange={days_of_week => setEditing({ ...editing, days_of_week })}
              />
            ) : (
              <ScheduleField
                label="SPECIFIC DATE"
                value={editing.specific_date ?? ''}
                onChangeText={specific_date => setEditing({ ...editing, specific_date })}
                placeholder="YYYY-MM-DD"
              />
            )}
            <ScheduleField
              label="START TIME"
              value={editing.start_time ?? ''}
              onChangeText={start_time => setEditing({ ...editing, start_time })}
              placeholder="12:00"
            />
            <ScheduleField
              label="END TIME"
              value={editing.end_time ?? ''}
              onChangeText={end_time => setEditing({ ...editing, end_time })}
              placeholder="13:00"
            />
            <ScheduleField
              label="INTERNAL NOTE (OPTIONAL)"
              value={editing.title ?? ''}
              onChangeText={title => setEditing({ ...editing, title })}
              placeholder="Only you can see this note"
              multiline
            />
            <Text style={styles.playerNote}>
              Players will see this time as unavailable. They will not see the type or internal note.
            </Text>
          </>
        )}
      </ScheduleEntrySheet>
    </>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    addButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: theme.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
      paddingVertical: 12,
    },
    entry: {
      flexDirection: 'row',
      gap: 12,
      borderRadius: Radius.sm,
      borderWidth: 2,
      borderColor: theme.borderStrong,
      backgroundColor: theme.surface2,
      padding: 12,
    },
    entryIcon: {
      width: 36,
      height: 44,
      borderRadius: Radius.xs,
      backgroundColor: 'rgba(90,99,121,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    entryCode: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
    },
    entryCopy: { flex: 1, gap: 2 },
    entryTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    entryMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },
    entryReason: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textSecondary,
    },
    unavailableLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      marginTop: 3,
    },
    playerNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    actions: { gap: 2 },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  }), [theme]);
}
