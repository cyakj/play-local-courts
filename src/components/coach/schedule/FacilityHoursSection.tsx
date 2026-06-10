import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachFacilityHour } from '@/types/coachSchedule';
import { createDraftId, formatDays, formatTime } from '@/types/coachSchedule';
import { SectionCard } from './SectionCard';
import {
  ChoiceChips,
  DayPicker,
  ScheduleEntrySheet,
  ScheduleField,
  VisibilityToggle,
} from './ScheduleEntrySheet';

interface Props {
  values: CoachFacilityHour[];
  coachId: string;
  onChange: (values: CoachFacilityHour[]) => void;
}

function emptyRecord(coachId: string): CoachFacilityHour {
  return {
    id: createDraftId('facility'),
    coach_id: coachId,
    facility_name: '',
    facility_address: null,
    court_type: null,
    days_of_week: [],
    start_time: '08:00',
    end_time: '12:00',
    publicly_bookable: true,
    notes: null,
    is_active: true,
  };
}

export function FacilityHoursSection({ values, coachId, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [editing, setEditing] = useState<CoachFacilityHour | null>(null);

  function apply() {
    if (!editing) return;
    onChange([...values.filter(item => item.id !== editing.id), editing]);
    setEditing(null);
  }

  return (
    <>
      <SectionCard
        title="Facility Coaching Rules"
        description="Fixed teaching windows at a named facility."
        action={
          <TouchableOpacity style={styles.addButton} onPress={() => setEditing(emptyRecord(coachId))} activeOpacity={0.8}>
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }>
        {values.length === 0 ? (
          <Text style={styles.empty}>No facility coaching rules in this draft.</Text>
        ) : values.map(record => (
          <View key={record.id} style={[styles.entry, record.publicly_bookable ? styles.publicEntry : styles.privateEntry]}>
            <View style={styles.entryIcon}>
              <Building2 size={18} color={Colors.blue} />
              <Text style={styles.entryCode}>F</Text>
            </View>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>{record.facility_name}</Text>
              {!!record.facility_address && <Text style={styles.entryMeta}>{record.facility_address}</Text>}
              {!!record.court_type && <Text style={styles.entryMeta}>Court: {record.court_type}</Text>}
              <Text style={styles.entryMeta}>{formatDays(record.days_of_week)}</Text>
              <Text style={styles.entryMeta}>{formatTime(record.start_time)} - {formatTime(record.end_time)}</Text>
              {!!record.notes && <Text style={styles.entryNote}>{record.notes}</Text>}
              <Text style={record.publicly_bookable ? styles.publicLabel : styles.privateLabel}>
                {record.publicly_bookable ? 'PUBLICLY BOOKABLE' : 'PRIVATE / INTERNAL'}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setEditing({ ...record })}>
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
        title={editing?.facility_name ? 'Edit Facility Coaching Rule' : 'Add Facility Coaching Rule'}
        onCancel={() => setEditing(null)}
        onSave={apply}
        saveDisabled={
          !editing ||
          !editing.facility_name.trim() ||
          editing.days_of_week.length === 0 ||
          editing.start_time >= editing.end_time
        }>
        {editing && (
          <>
            <ScheduleField
              label="FACILITY NAME"
              value={editing.facility_name}
              onChangeText={facility_name => setEditing({ ...editing, facility_name })}
              placeholder="Riverside Tennis Club"
            />
            <ScheduleField
              label="FACILITY ADDRESS"
              value={editing.facility_address ?? ''}
              onChangeText={facility_address => setEditing({ ...editing, facility_address })}
              placeholder="Street address"
            />
            <ChoiceChips
              label="COURT TYPE"
              value={editing.court_type ?? 'tennis'}
              options={[
                { value: 'tennis', label: 'Tennis' },
                { value: 'pickleball', label: 'Pickleball' },
                { value: 'hard', label: 'Hard' },
                { value: 'clay', label: 'Clay' },
                { value: 'indoor', label: 'Indoor' },
              ]}
              onChange={court_type => setEditing({ ...editing, court_type })}
            />
            <DayPicker selected={editing.days_of_week} onChange={days_of_week => setEditing({ ...editing, days_of_week })} />
            <ScheduleField label="START TIME" value={editing.start_time} onChangeText={start_time => setEditing({ ...editing, start_time })} placeholder="08:00" />
            <ScheduleField label="END TIME" value={editing.end_time} onChangeText={end_time => setEditing({ ...editing, end_time })} placeholder="12:00" />
            <VisibilityToggle value={editing.publicly_bookable} onChange={publicly_bookable => setEditing({ ...editing, publicly_bookable })} />
            <ScheduleField
              label="NOTES"
              value={editing.notes ?? ''}
              onChangeText={notes => setEditing({ ...editing, notes })}
              placeholder="Court access or parking details"
              multiline
            />
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
      backgroundColor: Colors.blue,
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
      borderWidth: 1,
      padding: 12,
    },
    publicEntry: {
      borderWidth: 2,
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.08)',
    },
    privateEntry: {
      borderColor: theme.border,
      backgroundColor: theme.surface2,
      opacity: 0.74,
    },
    entryIcon: {
      width: 36,
      height: 44,
      borderRadius: Radius.xs,
      backgroundColor: 'rgba(45,107,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    entryCode: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.blue,
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
    entryNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textSecondary,
      marginTop: 2,
    },
    publicLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.cyanOnLight,
      marginTop: 3,
    },
    privateLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      marginTop: 3,
    },
    actions: { gap: 2 },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  }), [theme]);
}
