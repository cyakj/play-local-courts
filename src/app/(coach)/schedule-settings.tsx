import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { AlertTriangle, ChevronRight, RotateCcw, Save } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachAvailabilityEditor } from '@/components/coach/CoachAvailabilityEditor';
import { CoachDaySetupSheet } from '@/components/coach/schedule/CoachDaySetupSheet';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { useCoachBlockouts } from '@/hooks/useCoachBlockouts';
import { useCoachGlobalHours } from '@/hooks/useCoachGlobalHours';
import { useCoachTeachingBlocks } from '@/hooks/useCoachTeachingBlocks';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type {
  CoachBlockout,
  CoachGlobalHour,
  CoachTeachingBlock,
  ScheduleDraft,
} from '@/types/coachSchedule';
import { createDraftId, DAY_NAMES, formatTime } from '@/types/coachSchedule';

function cloneDraft(draft: ScheduleDraft): ScheduleDraft {
  return JSON.parse(JSON.stringify(draft)) as ScheduleDraft;
}

function completeBoundaries(coachId: string, rows: CoachGlobalHour[]): CoachGlobalHour[] {
  return DAY_NAMES.map((_, day) => rows.find(row => row.day_of_week === day) ?? {
    id: createDraftId('boundary'),
    coach_id: coachId,
    day_of_week: day,
    start_time: '07:00',
    end_time: '20:00',
    is_closed: true,
  });
}

function splitRecurringBlockouts(
  rows: CoachBlockout[],
  preferredId?: string,
  preferredDay?: number | null,
): CoachBlockout[] {
  return rows.flatMap(row => {
    if (row.specific_date || !row.days_of_week?.length || row.days_of_week.length === 1) {
      return [row];
    }
    const originalDay = row.id === preferredId && preferredDay != null
      && row.days_of_week.includes(preferredDay)
      ? preferredDay
      : row.days_of_week[0];
    return row.days_of_week.map(day => ({
      ...row,
      id: day === originalDay ? row.id : createDraftId('blockout'),
      days_of_week: [day],
    }));
  });
}

function parseDay(value: string | string[] | undefined): number | null {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : null;
}

export default function ScheduleSettingsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    day?: string;
    blockId?: string;
    blockoutId?: string;
  }>();
  const allowLeave = useRef(false);
  const openedRouteTarget = useRef('');
  const [coachId, setCoachId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [original, setOriginal] = useState<ScheduleDraft | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [routeFocusActive, setRouteFocusActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  const globalHours = useCoachGlobalHours(coachId);
  const teachingBlocks = useCoachTeachingBlocks(coachId);
  const blockouts = useCoachBlockouts(coachId);
  const { weeklySlots, refresh: refreshSlots } = useCoachAvailability(coachId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCoachId(user?.id ?? null));
  }, []);

  const loading = !coachId
    || globalHours.loading
    || teachingBlocks.loading
    || blockouts.loading;

  const serverDraft = useMemo<ScheduleDraft | null>(() => {
    if (!coachId || loading) return null;
    return {
      globalHours: completeBoundaries(coachId, globalHours.hours),
      teachingBlocks: teachingBlocks.blocks,
      blockouts: splitRecurringBlockouts(
        blockouts.blockouts,
        Array.isArray(params.blockoutId) ? params.blockoutId[0] : params.blockoutId,
        parseDay(params.day),
      ),
    };
  }, [
    blockouts.blockouts,
    coachId,
    globalHours.hours,
    loading,
    params.blockoutId,
    params.day,
    teachingBlocks.blocks,
  ]);

  useEffect(() => {
    if (!serverDraft || draft) return;
    setDraft(cloneDraft(serverDraft));
    setOriginal(cloneDraft(serverDraft));
  }, [draft, serverDraft]);

  useEffect(() => {
    if (!draft) return;
    const day = parseDay(params.day);
    if (day == null) return;
    const routeTarget = `${day}:${params.blockId ?? ''}:${params.blockoutId ?? ''}`;
    if (openedRouteTarget.current === routeTarget) return;
    openedRouteTarget.current = routeTarget;
    setRouteFocusActive(true);
    setSelectedDay(day);
  }, [draft, params.blockId, params.blockoutId, params.day]);

  const dirty = useMemo(
    () => !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original),
    [draft, original],
  );
  const scheduleSchemaUnavailable = globalHours.schemaUnavailable
    || teachingBlocks.schemaUnavailable
    || blockouts.schemaUnavailable;
  const canSave = dirty && !saving && !scheduleSchemaUnavailable;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (!dirty || allowLeave.current) return;
      event.preventDefault();
      Alert.alert(
        'Discard unsaved changes?',
        'Your schedule draft has not been saved.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              allowLeave.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [dirty, navigation]);

  function applyDay(
    boundary: CoachGlobalHour,
    dayBlocks: CoachTeachingBlock[],
    dayBlockouts: CoachBlockout[],
  ) {
    if (!draft) return;
    const day = boundary.day_of_week;
    const editedBlockoutIds = new Set(dayBlockouts.map(row => row.id));
    const focusedBlockoutId = day === parseDay(params.day)
      ? (Array.isArray(params.blockoutId) ? params.blockoutId[0] : params.blockoutId)
      : undefined;
    if (focusedBlockoutId) editedBlockoutIds.add(focusedBlockoutId);
    setDraft({
      globalHours: [
        ...draft.globalHours.filter(row => row.day_of_week !== day),
        boundary,
      ].sort((a, b) => a.day_of_week - b.day_of_week),
      teachingBlocks: [
        ...draft.teachingBlocks.filter(row => row.day_of_week !== day),
        ...dayBlocks,
      ].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)),
      blockouts: [
        ...draft.blockouts.filter(row =>
          !editedBlockoutIds.has(row.id)
          && (row.specific_date || !row.days_of_week?.includes(day)),
        ),
        ...dayBlockouts.map(row => ({
          ...row,
          specific_date: row.specific_date,
          days_of_week: row.specific_date ? null : [day],
          visibility: 'show_as_unavailable' as const,
        })),
      ],
    });
    setSaveError(null);
    setSavedMessage('');
    setRouteFocusActive(false);
    setSelectedDay(null);
  }

  function cancelChanges() {
    if (!original) return;
    Alert.alert('Cancel schedule changes?', 'This restores the last saved schedule.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Cancel Changes',
        style: 'destructive',
        onPress: () => {
          setDraft(cloneDraft(original));
          setSaveError(null);
          setSavedMessage('');
          setRouteFocusActive(false);
          setSelectedDay(null);
        },
      },
    ]);
  }

  async function saveChanges() {
    if (!draft || !original) return;
    setSaving(true);
    setSaveError(null);
    setSavedMessage('');
    try {
      await globalHours.save(draft.globalHours);
      const savedTeachingBlocks = await teachingBlocks.save(draft.teachingBlocks);
      const savedBlockouts = await blockouts.save(draft.blockouts, original.blockouts);
      const persistedDraft: ScheduleDraft = {
        globalHours: cloneDraft(draft).globalHours,
        teachingBlocks: savedTeachingBlocks,
        blockouts: splitRecurringBlockouts(savedBlockouts),
      };
      setDraft(cloneDraft(persistedDraft));
      setOriginal(cloneDraft(persistedDraft));
      setSavedMessage('Schedule changes saved.');
      await Promise.all([
        globalHours.refresh(),
        teachingBlocks.refresh(),
        blockouts.refresh(),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save schedule changes.';
      setSaveError(
        message.includes('overlap')
          ? 'Teaching blocks cannot overlap on the same day. Use Either for flexible time.'
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  const queryError = globalHours.error || teachingBlocks.error || blockouts.error;
  const backToSchedule = () => router.replace('/(coach)/schedule' as any);
  const routeDay = parseDay(params.day);
  const focusedBlockId = routeFocusActive && selectedDay === routeDay
    ? (Array.isArray(params.blockId) ? params.blockId[0] : params.blockId)
    : undefined;
  const focusedBlockoutId = routeFocusActive && selectedDay === routeDay
    ? (Array.isArray(params.blockoutId) ? params.blockoutId[0] : params.blockoutId)
    : undefined;
  const activeBoundary = selectedDay == null
    ? null
    : draft?.globalHours.find(row => row.day_of_week === selectedDay) ?? null;
  const activeBlocks = selectedDay == null
    ? []
    : draft?.teachingBlocks.filter(row => row.day_of_week === selectedDay) ?? [];
  const activeBlockouts = selectedDay == null
    ? []
    : draft?.blockouts.filter(row =>
      (!row.specific_date && row.days_of_week?.includes(selectedDay))
      || row.id === focusedBlockoutId,
    ) ?? [];

  if (loading || !draft || !coachId) {
    return (
      <View style={styles.screen}>
        <Header variant="inner" title="Schedule Control Center" onBack={backToSchedule} />
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.cyan} />
          <Text style={styles.loadingText}>Loading schedule controls...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Schedule Control Center" onBack={backToSchedule} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>WEEKLY RULES</Text>
          <Text style={styles.introTitle}>Schedule Settings</Text>
        </View>

        {dirty && (
          <View style={styles.warning}>
            <AlertTriangle size={18} color={Colors.volt} />
            <Text style={styles.warningText}>You have unsaved schedule changes.</Text>
          </View>
        )}
        {scheduleSchemaUnavailable && (
          <View style={styles.storageNotice}>
            <AlertTriangle size={18} color={Colors.volt} />
            <Text style={styles.storageNoticeText}>
              Schedule storage is being updated. Existing schedule rules remain unchanged.
            </Text>
          </View>
        )}
        {(saveError || queryError) && <Text style={styles.error}>{saveError ?? queryError}</Text>}
        {!!savedMessage && <Text style={styles.success}>{savedMessage}</Text>}

        {/* Availability slots — day-pill editor */}
        <CoachAvailabilityEditor slots={weeklySlots} onRefresh={refreshSlots} />

        {/* Coaching boundaries — global hours, teaching blocks, blockouts */}
        <Text style={styles.eyebrow}>COACHING BOUNDARIES</Text>
        <Text style={styles.introBody}>
          Tap a day to set its boundary, teaching blocks, and unavailable times.
        </Text>

        <View style={styles.dayList}>
          {draft.globalHours.map(boundary => {
            const dayBlocks = draft.teachingBlocks.filter(
              block => block.day_of_week === boundary.day_of_week,
            );
            const dayBlockouts = draft.blockouts.filter(
              blockout => !blockout.specific_date
                && blockout.days_of_week?.includes(boundary.day_of_week),
            );
            return (
              <TouchableOpacity
                key={boundary.day_of_week}
                style={styles.dayRow}
                onPress={() => {
                  setRouteFocusActive(false);
                  setSelectedDay(boundary.day_of_week);
                }}
                activeOpacity={0.78}>
                <View style={styles.dayCopy}>
                  <View style={styles.dayHeading}>
                    <Text style={styles.dayName}>{DAY_NAMES[boundary.day_of_week]}</Text>
                    <Text style={boundary.is_closed ? styles.inactive : styles.active}>
                      {boundary.is_closed
                        ? 'Inactive'
                        : `${formatTime(boundary.start_time)} - ${formatTime(boundary.end_time)}`}
                    </Text>
                  </View>
                  {!boundary.is_closed && (
                    <Text style={styles.dayMeta}>
                      {dayBlocks.length} teaching {dayBlocks.length === 1 ? 'block' : 'blocks'}
                      {'  ·  '}
                      {dayBlockouts.length} unavailable
                    </Text>
                  )}
                </View>
                <ChevronRight size={21} color={theme.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cancelButton, !dirty && styles.disabled]}
          onPress={cancelChanges}
          disabled={!dirty || saving}
          activeOpacity={0.8}>
          <RotateCcw size={17} color={theme.textSecondary} />
          <Text style={styles.cancelLabel}>Cancel Changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.disabled]}
          onPress={saveChanges}
          disabled={!canSave}
          activeOpacity={0.85}>
          <Save size={17} color="#FFFFFF" />
          <Text style={styles.saveLabel}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>

      {activeBoundary && selectedDay != null && (
        <CoachDaySetupSheet
          visible
          coachId={coachId}
          day={selectedDay}
          boundary={activeBoundary}
          teachingBlocks={activeBlocks}
          blockouts={activeBlockouts}
          focusBlockId={focusedBlockId}
          focusBlockoutId={focusedBlockoutId}
          onClose={() => {
            setRouteFocusActive(false);
            setSelectedDay(null);
          }}
          onApply={applyDay}
        />
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    content: {
      width: '100%',
      maxWidth: MaxWidth,
      alignSelf: 'center',
      padding: Spacing.pagePx,
      paddingBottom: 130,
      gap: Spacing.cardGap,
    },
    intro: { gap: 5, paddingVertical: 4 },
    eyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.cyan,
      letterSpacing: 1.8,
    },
    introTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    introBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textMuted,
    },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(214,255,61,0.35)',
      backgroundColor: 'rgba(214,255,61,0.08)',
      padding: 12,
    },
    warningText: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    storageNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(214,255,61,0.28)',
      backgroundColor: 'rgba(214,255,61,0.06)',
      padding: 12,
    },
    storageNoticeText: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    error: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
      padding: 12,
      borderRadius: Radius.sm,
      backgroundColor: 'rgba(255,92,107,0.10)',
    },
    success: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.positive,
      padding: 12,
      borderRadius: Radius.sm,
      backgroundColor: 'rgba(47,217,139,0.10)',
    },
    dayList: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      overflow: 'hidden',
      ...theme.shadowCard,
    },
    dayRow: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    dayCopy: { flex: 1, gap: 5 },
    dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dayName: {
      width: 92,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    active: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
    inactive: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    dayMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 12,
      paddingBottom: 28,
      backgroundColor: theme.navBg,
      borderTopWidth: 1,
      borderTopColor: theme.navBorder,
      ...theme.shadowNav,
    },
    cancelButton: {
      flex: 1,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.cardBg,
    },
    cancelLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: theme.textSecondary,
    },
    saveButton: {
      flex: 1.25,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: Radius.button,
      backgroundColor: Colors.blue,
    },
    saveLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: '#FFFFFF',
    },
    disabled: { opacity: 0.4 },
  }), [theme]);
}
