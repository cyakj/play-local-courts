import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Car, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachSchedulePrivateSettings, CoachTravelHour } from '@/types/coachSchedule';
import { createDraftId, formatDays, formatTime } from '@/types/coachSchedule';
import { SectionCard } from './SectionCard';
import {
  DayPicker,
  ScheduleEntrySheet,
  ScheduleField,
  VisibilityToggle,
} from './ScheduleEntrySheet';

interface Props {
  values: CoachTravelHour[];
  privateSettings: CoachSchedulePrivateSettings;
  coachId: string;
  onChange: (values: CoachTravelHour[]) => void;
  onPrivateSettingsChange: (settings: CoachSchedulePrivateSettings) => void;
}

function emptyRecord(coachId: string): CoachTravelHour {
  return {
    id: createDraftId('travel'),
    coach_id: coachId,
    travel_radius_miles: null,
    areas_served: [],
    days_of_week: [],
    start_time: '08:00',
    end_time: '12:00',
    publicly_bookable: true,
    travel_notes: null,
    is_active: true,
  };
}

export function TravelHoursSection({
  values,
  privateSettings,
  coachId,
  onChange,
  onPrivateSettingsChange,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [editing, setEditing] = useState<CoachTravelHour | null>(null);

  function apply() {
    if (!editing) return;
    onChange([...values.filter(item => item.id !== editing.id), editing]);
    setEditing(null);
  }

  return (
    <>
      <SectionCard
        title="Travel Coaching Rules"
        description="Create separate travel rules when your travel radius, areas served, or available times differ."
        action={
          <TouchableOpacity style={styles.addButton} onPress={() => setEditing(emptyRecord(coachId))} activeOpacity={0.8}>
            <Plus size={18} color="#0C0F18" />
          </TouchableOpacity>
        }>
        <ScheduleField
          label="PRIVATE TRAVEL BASE ADDRESS"
          value={privateSettings.travel_base_address ?? ''}
          onChangeText={travel_base_address => onPrivateSettingsChange({ ...privateSettings, travel_base_address })}
          placeholder="Home or starting address"
          privateField
        />
        <Text style={styles.privacyNote}>Stored separately with owner-only access. It is never included in public travel-hour rows.</Text>

        {values.length === 0 ? (
          <Text style={styles.empty}>No travel coaching rules in this draft.</Text>
        ) : values.map(record => (
          <View key={record.id} style={[styles.entry, record.publicly_bookable ? styles.publicEntry : styles.privateEntry]}>
            <View style={styles.entryIcon}>
              <Car size={18} color={Colors.volt} />
              <Text style={styles.entryCode}>T</Text>
            </View>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>
                {record.travel_radius_miles ? `${record.travel_radius_miles} mile radius` : 'Travel window'}
              </Text>
              <Text style={styles.entryMeta}>{formatDays(record.days_of_week)}</Text>
              <Text style={styles.entryMeta}>{formatTime(record.start_time)} - {formatTime(record.end_time)}</Text>
              {!!record.areas_served.length && <Text style={styles.entryMeta}>{record.areas_served.join(', ')}</Text>}
              {!!record.travel_notes && <Text style={styles.entryNote}>{record.travel_notes}</Text>}
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
        title={editing && !editing.id.startsWith('draft-')
          ? 'Edit Travel Availability Rule'
          : 'Add Travel Availability Rule'}
        onCancel={() => setEditing(null)}
        onSave={apply}
        saveDisabled={
          !editing ||
          editing.days_of_week.length === 0 ||
          editing.start_time >= editing.end_time ||
          editing.travel_radius_miles == null ||
          editing.travel_radius_miles <= 0
        }>
        {editing && (
          <>
            <DayPicker selected={editing.days_of_week} onChange={days_of_week => setEditing({ ...editing, days_of_week })} />
            <ScheduleField label="START TIME" value={editing.start_time} onChangeText={start_time => setEditing({ ...editing, start_time })} placeholder="08:00" />
            <ScheduleField label="END TIME" value={editing.end_time} onChangeText={end_time => setEditing({ ...editing, end_time })} placeholder="12:00" />
            <ScheduleField
              label="TRAVEL RADIUS (MILES)"
              value={editing.travel_radius_miles?.toString() ?? ''}
              onChangeText={value => {
                const radius = Number(value);
                setEditing({
                  ...editing,
                  travel_radius_miles: value && Number.isFinite(radius) ? radius : null,
                });
              }}
              placeholder="10"
              keyboardType="numeric"
            />
            <ScheduleField
              label="AREAS SERVED"
              value={editing.areas_served.join(', ')}
              onChangeText={value => setEditing({
                ...editing,
                areas_served: value.split(',').map(item => item.trim()).filter(Boolean),
              })}
              placeholder="Dorado, San Juan, Guaynabo"
            />
            <ScheduleField
              label="TRAVEL NOTES"
              value={editing.travel_notes ?? ''}
              onChangeText={travel_notes => setEditing({ ...editing, travel_notes })}
              placeholder="Travel conditions or student instructions"
              multiline
            />
            <VisibilityToggle value={editing.publicly_bookable} onChange={publicly_bookable => setEditing({ ...editing, publicly_bookable })} />
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
      backgroundColor: Colors.volt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    privacyNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
      marginTop: -8,
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
      borderColor: Colors.volt,
      backgroundColor: 'rgba(214,255,61,0.07)',
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
      backgroundColor: 'rgba(214,255,61,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    entryCode: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.voltLo,
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
      color: Colors.voltLo,
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
