import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import type { CoachAvailabilitySlot, CoachUnavailabilityBlock } from '@/hooks/useCoachAvailability';
import type { LessonPackage } from '@/hooks/useLessonPackages';

// ── Types ────────────────────────────────────────────────────────────────────

const LESSON_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Private Lesson',      value: 'private_lesson'      },
  { label: 'Semi-Private Lesson', value: 'semi_private_lesson'  },
  { label: 'Group Clinic',        value: 'group_clinic'         },
  { label: 'Practice Session',    value: 'practice_session'     },
];

const DURATIONS: { label: string; value: 30 | 60 | 90 }[] = [
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
];

const SKILL_LEVELS: { label: string; value: string }[] = [
  { label: 'Beginner',         value: 'beginner'        },
  { label: 'Intermediate',     value: 'intermediate'     },
  { label: 'High Performance', value: 'high_performance' },
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

type Step = 1 | 2 | 3 | 4 | 5;
type LocationPref = 'already_have_court' | 'need_court' | 'decide_with_coach' | 'coach_facility';

interface TimeSlotOption {
  start: string;          // 'HH:MM' 24h
  end: string;            // 'HH:MM' 24h
  display: string;        // '10:00 AM'
  locationMode: 'coach_facility' | 'traveling' | 'both' | null;
}

export interface BookLessonSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  coachUserId: string;
  coachName: string;
  homeBase: string | null;
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks: CoachUnavailabilityBlock[];
  packages?: LessonPackage[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

function formatTime12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function isBlockedDate(date: Date, blocks: CoachUnavailabilityBlock[]): boolean {
  const mo = date.getMonth() + 1;
  const d  = date.getDate();
  for (const b of blocks) {
    if (b.recurs_annually) {
      const [,bsm, bsd] = b.start_date.split('-').map(Number);
      const [,bem, bed] = b.end_date.split('-').map(Number);
      const val  = mo * 100 + d;
      const sval = bsm * 100 + bsd;
      const eval_ = bem * 100 + bed;
      if (sval <= eval_) { if (val >= sval && val <= eval_) return true; }
      else { if (val >= sval || val <= eval_) return true; }
    } else {
      const start = new Date(b.start_date + 'T00:00:00');
      const end   = new Date(b.end_date   + 'T00:00:00');
      if (date >= start && date <= end) return true;
    }
  }
  return false;
}

function hasSlotOnDate(date: Date, slots: CoachAvailabilitySlot[]): boolean {
  return slots.some(s => s.day_of_week === date.getDay());
}

function generateTimeSlots(
  date: Date,
  durationMin: number,
  slots: CoachAvailabilitySlot[],
): TimeSlotOption[] {
  const dow    = date.getDay();
  const result: TimeSlotOption[] = [];
  const seen   = new Set<string>();

  for (const slot of slots) {
    if (slot.day_of_week !== dow) continue;
    const slotStart = timeToMin(slot.start_time);
    const slotEnd   = timeToMin(slot.end_time);
    let t = slotStart;
    while (t + durationMin <= slotEnd) {
      const start = minToTime(t);
      if (!seen.has(start)) {
        seen.add(start);
        result.push({
          start,
          end:          minToTime(t + durationMin),
          display:      formatTime12h(start),
          locationMode: slot.location_mode ?? null,
        });
      }
      t += 30;
    }
  }

  return result.sort((a, b) => a.start.localeCompare(b.start));
}

// Location options shown depends on the selected slot's locationMode
function getLocationOptions(
  slotLocationMode: 'coach_facility' | 'traveling' | 'both' | null,
  homeBase: string | null,
): { value: LocationPref; label: string; description: string }[] {
  const coachFacilityOption = {
    value:       'coach_facility' as LocationPref,
    label:       'Coach Facility',
    description: homeBase ? `Location: ${homeBase}` : "Coach's facility",
  };

  const playerOptions: { value: LocationPref; label: string; description: string }[] = [
    {
      value:       'already_have_court',
      label:       'I already have a court',
      description: 'Enter facility name and any notes',
    },
    {
      value:       'need_court',
      label:       'Need to reserve a court',
      description: 'Your preference will be shared with the coach',
    },
    {
      value:       'decide_with_coach',
      label:       'Message coach to decide',
      description: 'Coordinate location in chat after approval',
    },
  ];

  if (slotLocationMode === 'coach_facility') return [coachFacilityOption];
  if (slotLocationMode === 'traveling')      return playerOptions;
  if (slotLocationMode === 'both')           return [coachFacilityOption, ...playerOptions];
  // null / no location mode → show player options
  return playerOptions;
}

// ── Component ────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
}

export function BookLessonSheet({
  visible,
  onClose,
  onSuccess,
  coachUserId,
  coachName,
  homeBase,
  weeklySlots,
  unavailabilityBlocks,
  packages = [],
}: BookLessonSheetProps) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [step,           setStep]          = useState<Step>(1);
  const [lessonType,     setLessonType]    = useState<string | null>(null);
  const [duration,       setDuration]      = useState<30|60|90|null>(null);
  const [skillLevel,     setSkillLevel]    = useState<string | null>(null);
  const [selectedDate,   setSelectedDate]  = useState<Date | null>(null);
  const [selectedSlot,   setSelectedSlot]  = useState<TimeSlotOption | null>(null);
  const [locationPref,   setLocationPref]  = useState<LocationPref | null>(null);
  const [facilityName,   setFacilityName]  = useState('');
  const [locationNote,   setLocationNote]  = useState('');
  const [notes,          setNotes]         = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [submitting,     setSubmitting]    = useState(false);
  const [success,        setSuccess]       = useState(false);

  // Calendar state
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const cutoff = useMemo(() => { const d = new Date(today); d.setDate(d.getDate()+60); return d; }, [today]);
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const calCells = useMemo((): (Date|null)[] => {
    const first = new Date(calYear, calMonth, 1);
    const pad   = first.getDay();
    const days  = new Date(calYear, calMonth+1, 0).getDate();
    return [
      ...Array(pad).fill(null),
      ...Array.from({ length: days }, (_,i) => new Date(calYear, calMonth, i+1)),
    ];
  }, [calYear, calMonth]);

  const calWeeks = useMemo((): (Date|null)[][] => {
    const weeks: (Date|null)[][] = [];
    for (let i=0; i<calCells.length; i+=7) weeks.push(calCells.slice(i, i+7));
    return weeks;
  }, [calCells]);

  const isSelectedToday = useMemo(
    () => selectedDate ? selectedDate.getTime() === today.getTime() : false,
    [selectedDate, today],
  );

  // Time slots for selected date + duration, filtered to future-only when today
  const timeSlots = useMemo((): TimeSlotOption[] => {
    if (!selectedDate || !duration) return [];
    const all = generateTimeSlots(selectedDate, duration, weeklySlots);
    if (!isSelectedToday) return all;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return all.filter(s => timeToMin(s.start) > nowMin);
  }, [selectedDate, duration, weeklySlots, isSelectedToday]);

  // Location options for selected slot
  const locationOptions = useMemo(
    () => getLocationOptions(selectedSlot?.locationMode ?? null, homeBase),
    [selectedSlot, homeBase],
  );

  // Auto-select coach_facility if it's the only option
  useMemo(() => {
    if (locationOptions.length === 1 && locationOptions[0].value === 'coach_facility') {
      setLocationPref('coach_facility');
    }
  }, [locationOptions]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); }
    else setCalMonth(m=>m-1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0); }
    else setCalMonth(m=>m+1);
  }

  function resetSheet() {
    setStep(1);
    setLessonType(null);
    setDuration(null);
    setSkillLevel(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setLocationPref(null);
    setFacilityName('');
    setLocationNote('');
    setNotes('');
    setSelectedPackageId(null);
    setSubmitting(false);
    setSuccess(false);
  }

  function handleClose() {
    resetSheet();
    onClose();
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!lessonType && !!duration && !!skillLevel;
      case 2: return selectedDate != null;
      case 3: return true; // slot selection best-effort
      case 4: return locationPref != null;
      default: return true;
    }
  }

  function advance() {
    if (!canAdvance()) return;
    if (step < 5) setStep(s => (s + 1) as Step);
  }

  function goBack() {
    if (step > 1) setStep(s => (s - 1) as Step);
  }

  async function handleSubmit() {
    if (!lessonType || !duration || !skillLevel || !selectedDate) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('lesson_requests')
      .insert({
        coach_id:            coachUserId,
        player_id:           user.id,
        lesson_type:         lessonType,
        duration_minutes:    duration,
        skill_level:         skillLevel,
        sport:               'tennis',
        preferred_date:      isoDate(selectedDate),
        preferred_time_start: selectedSlot?.start ?? null,
        preferred_time_end:   selectedSlot?.end ?? null,
        location_preference: locationPref ?? 'decide_with_coach',
        facility_name:       facilityName.trim() || null,
        location_note:       locationNote.trim() || null,
        notes:               notes.trim() || null,
        status:              'pending',
        expires_at:          expiresAt,
        package_id:          selectedPackageId ?? null,
      } as any);

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', 'Could not send request. Please try again.');
      return;
    }

    // Notify the coach of the new request (fire and forget)
    sendNotificationEmail({
      type: 'lesson_request_received',
      userId: coachUserId,
      playerId: user.id,
      lessonType,
      date: isoDate(selectedDate),
      startTime: selectedSlot?.start,
      endTime: selectedSlot?.end,
    });

    setSuccess(true);
    setTimeout(() => {
      resetSheet();
      onClose();
      onSuccess();
    }, 1800);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!visible) return null;

  const totalSteps = 5;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Lesson</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Progress dots */}
        {!success && (
          <View style={styles.dots}>
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <View
                key={s}
                style={[
                  styles.dot,
                  s === step && styles.dotActive,
                  s < step  && styles.dotDone,
                ]}
              />
            ))}
          </View>
        )}

        {success ? (
          <View style={styles.successWrap}>
            <Text style={styles.successCheckmark}>✓</Text>
            <Text style={styles.successTitle}>Request Sent!</Text>
            <Text style={styles.successBody}>{coachName} has 48 hours to respond.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Step 1: Lesson Details ── */}
            {step === 1 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Lesson Details</Text>

                <Text style={styles.fieldLabel}>Lesson Type</Text>
                <View style={styles.optionGrid}>
                  {LESSON_TYPE_OPTIONS.map(lt => (
                    <TouchableOpacity
                      key={lt.value}
                      style={[styles.option, lessonType === lt.value && styles.optionActive]}
                      onPress={() => setLessonType(lt.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.optionLabel, lessonType === lt.value && styles.optionLabelActive]}>
                        {lt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Duration</Text>
                <View style={styles.chipRow}>
                  {DURATIONS.map(d => (
                    <TouchableOpacity
                      key={d.value}
                      style={[styles.chip, duration === d.value && styles.chipActive]}
                      onPress={() => setDuration(d.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipLabel, duration === d.value && styles.chipLabelActive]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Skill Level</Text>
                <View style={styles.chipRow}>
                  {SKILL_LEVELS.map(sl => (
                    <TouchableOpacity
                      key={sl.value}
                      style={[styles.chip, skillLevel === sl.value && styles.chipActive]}
                      onPress={() => setSkillLevel(sl.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipLabel, skillLevel === sl.value && styles.chipLabelActive]}>
                        {sl.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── Step 2: Date ── */}
            {step === 2 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Select Date</Text>
                <Text style={styles.stepSubtitle}>
                  Highlighted dates match the coach's schedule.
                </Text>

                <View style={styles.calCard}>
                  {/* Month nav */}
                  <View style={styles.calNav}>
                    <TouchableOpacity onPress={prevMonth} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                      <ChevronLeft size={18} strokeWidth={1.5} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.calMonthLabel}>{MONTH_NAMES[calMonth]} {calYear}</Text>
                    <TouchableOpacity onPress={nextMonth} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                      <ChevronRight size={18} strokeWidth={1.5} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Day labels */}
                  <View style={styles.calWeekRow}>
                    {DAY_LABELS.map(dl => (
                      <Text key={dl} style={styles.calDayLabel}>{dl}</Text>
                    ))}
                  </View>

                  {/* Weeks */}
                  {calWeeks.map((week, wi) => (
                    <View key={wi} style={styles.calWeekRow}>
                      {week.map((day, di) => {
                        if (!day) return <View key={di} style={styles.calCell} />;
                        const isPast     = day < today;
                        const isBeyond   = day > cutoff;
                        const blocked    = isBlockedDate(day, unavailabilityBlocks);
                        const hasSlot    = hasSlotOnDate(day, weeklySlots);
                        const isDisabled = isPast || isBeyond || blocked;
                        const isSelected = selectedDate?.getTime() === day.getTime();

                        return (
                          <TouchableOpacity
                            key={di}
                            style={[
                              styles.calCell,
                              isSelected && styles.calCellSelected,
                              !isSelected && hasSlot && !isDisabled && styles.calCellAvailable,
                              isDisabled && styles.calCellDisabled,
                            ]}
                            onPress={() => {
                              if (isDisabled) return;
                              setSelectedDate(day);
                              setSelectedSlot(null); // reset slot on date change
                              setLocationPref(null);
                            }}
                            disabled={isDisabled}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.calDayNum,
                              isSelected && { color: Colors.white },
                              !isSelected && hasSlot && !isDisabled && { color: Colors.cyan },
                              isDisabled && { color: theme.textMuted },
                            ]}>
                              {day.getDate()}
                            </Text>
                            {blocked && !isPast && (
                              <View style={styles.blockedDot} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {Array.from({ length: 7 - week.length }, (_,i) => (
                        <View key={`p${i}`} style={styles.calCell} />
                      ))}
                    </View>
                  ))}
                </View>

                {selectedDate && (
                  <View style={styles.selectedDateBadge}>
                    <Text style={styles.selectedDateBadgeTxt}>
                      {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long', month: 'long', day: 'numeric',
                      })}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Step 3: Time Slot ── */}
            {step === 3 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Select Time</Text>
                <Text style={styles.stepSubtitle}>
                  Available {duration}-min slots on{' '}
                  {selectedDate?.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}.
                </Text>

                {timeSlots.length === 0 ? (
                  <View style={styles.noSlotsBanner}>
                    <Text style={styles.noSlotsTxt}>
                      {isSelectedToday
                        ? 'No remaining times available today.'
                        : 'No scheduled slots on this date. You can still send the request — the coach will coordinate a time.'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.slotsGrid}>
                    {timeSlots.map(slot => (
                      <TouchableOpacity
                        key={slot.start}
                        style={[
                          styles.slotChip,
                          selectedSlot?.start === slot.start && styles.slotChipActive,
                        ]}
                        onPress={() => {
                          setSelectedSlot(slot);
                          setLocationPref(null); // reset location on slot change
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[
                          styles.slotChipLabel,
                          selectedSlot?.start === slot.start && styles.slotChipLabelActive,
                        ]}>
                          {slot.display}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {timeSlots.length > 0 && !selectedSlot && (
                  <Text style={styles.hintTxt}>Tap a slot to select it.</Text>
                )}
              </View>
            )}

            {/* ── Step 4: Location ── */}
            {step === 4 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Location</Text>

                {locationOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.locationOption, locationPref === opt.value && styles.locationOptionActive]}
                    onPress={() => setLocationPref(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.locationOptionHeader}>
                      <View style={[
                        styles.radio,
                        locationPref === opt.value && styles.radioActive,
                      ]}>
                        {locationPref === opt.value && <View style={styles.radioDot} />}
                      </View>
                      <Text style={[
                        styles.locationOptionLabel,
                        locationPref === opt.value && styles.locationOptionLabelActive,
                      ]}>
                        {opt.label}
                      </Text>
                    </View>
                    <Text style={styles.locationOptionDesc}>{opt.description}</Text>
                  </TouchableOpacity>
                ))}

                {/* Sub-form for "already have a court" */}
                {locationPref === 'already_have_court' && (
                  <View style={styles.subForm}>
                    <Text style={styles.fieldLabel}>Facility / court name (optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={facilityName}
                      onChangeText={setFacilityName}
                      placeholder="e.g. Westside Tennis Club"
                      placeholderTextColor={theme.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Notes (optional)</Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 72 }]}
                      value={locationNote}
                      onChangeText={setLocationNote}
                      placeholder="Court number, access details…"
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                )}
              </View>
            )}

            {/* ── Step 5: Review & Send ── */}
            {step === 5 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Review & Send</Text>

                <View style={styles.summaryCard}>
                  <SummaryRow label="Lesson Type"  value={LESSON_TYPE_OPTIONS.find(lt => lt.value === lessonType)?.label ?? ''} />
                  <SummaryRow label="Duration"     value={`${duration} min`} />
                  <SummaryRow label="Skill Level"  value={SKILL_LEVELS.find(s=>s.value===skillLevel)?.label ?? ''} />
                  <SummaryRow
                    label="Date"
                    value={selectedDate?.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) ?? ''}
                  />
                  <SummaryRow
                    label="Time"
                    value={selectedSlot ? selectedSlot.display : 'Coach will coordinate'}
                  />
                  <SummaryRow
                    label="Location"
                    value={
                      locationPref === 'coach_facility'      ? (homeBase ?? 'Coach Facility') :
                      locationPref === 'already_have_court'  ? (facilityName || 'My court') :
                      locationPref === 'need_court'          ? 'Need to reserve a court' :
                                                               'Message coach to decide'
                    }
                  />
                  <SummaryRow label="Student" value="Myself" />
                  {selectedPackageId && (() => {
                    const pkg = packages.find(p => p.id === selectedPackageId);
                    return pkg ? <SummaryRow label="Package" value={`${pkg.title} · ${formatPrice(pkg.price)}`} /> : null;
                  })()}
                </View>

                {packages.length > 0 && (
                  <View style={styles.packageSection}>
                    <Text style={styles.packageSectionLabel}>ADD A PACKAGE (optional)</Text>
                    {packages.map(pkg => {
                      const selected = selectedPackageId === pkg.id;
                      const typeLabel = pkg.lessonType
                        ? ({ 'private': 'Private', 'semi-private': 'Semi-Private', 'group': 'Group', 'junior': 'Junior' } as Record<string, string>)[pkg.lessonType]
                        : null;
                      return (
                        <TouchableOpacity
                          key={pkg.id}
                          style={[styles.pkgCard, selected && styles.pkgCardActive]}
                          onPress={() => setSelectedPackageId(selected ? null : pkg.id)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.pkgCardRow}>
                            <View style={styles.pkgRadio}>
                              {selected && <View style={styles.pkgRadioDot} />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.pkgTitle, selected && styles.pkgTitleActive]} numberOfLines={1}>
                                {pkg.title}
                              </Text>
                              <Text style={styles.pkgMeta}>
                                {pkg.durationMin} min
                                {typeLabel ? ` · ${typeLabel}` : ''}
                                {pkg.numSessions > 1 ? ` · ${pkg.numSessions} sessions` : ''}
                              </Text>
                            </View>
                            <Text style={[styles.pkgPrice, selected && styles.pkgPriceActive]}>
                              {formatPrice(pkg.price)}
                            </Text>
                          </View>
                          {pkg.description ? (
                            <Text style={styles.pkgDesc} numberOfLines={2}>{pkg.description}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Message to Coach (optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any notes, goals, or preferences…"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={400}
                  textAlignVertical="top"
                />

                <View style={styles.approvalNote}>
                  <Text style={styles.approvalNoteTxt}>
                    Every lesson requires coach approval. Selecting a time does not confirm the lesson.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Nav footer */}
        {!success && (
          <View style={styles.navFooter}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
                <ChevronLeft size={16} strokeWidth={2} color={theme.textSecondary} />
                <Text style={styles.backBtnLabel}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {step < totalSteps ? (
              <TouchableOpacity
                style={[styles.nextBtn, !canAdvance() && styles.nextBtnDisabled]}
                onPress={advance}
                activeOpacity={0.8}
                disabled={!canAdvance()}
              >
                <Text style={styles.nextBtnLabel}>Next</Text>
                <ChevronRight size={16} strokeWidth={2} color={Colors.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.8}
                disabled={submitting}
              >
                <Text style={styles.submitBtnLabel}>
                  {submitting ? 'Sending…' : 'Send Lesson Request'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    }}>
      <Text style={{
        fontFamily: FontFamily.manropeMedium,
        fontSize: FontSize.label,
        color: theme.textMuted,
      }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: FontFamily.manropeSemiBold,
        fontSize: FontSize.label,
        color: theme.textPrimary,
        flex: 1,
        textAlign: 'right',
        marginLeft: 12,
      }}>
        {value}
      </Text>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    dotActive: {
      backgroundColor: Colors.cyan,
      width: 20,
    },
    dotDone: {
      backgroundColor: Colors.positive,
    },
    body: {
      paddingBottom: 20,
    },
    stepWrap: {
      paddingHorizontal: Spacing.pagePx,
      gap: 16,
      paddingTop: 4,
    },
    stepTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    stepSubtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 22,
      marginTop: -8,
    },
    fieldLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },

    // Lesson type
    optionGrid: { gap: 8 },
    option: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionActive: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.40)',
    },
    optionLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    optionLabelActive: { color: Colors.cyan },

    // Chips
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.40)',
    },
    chipLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipLabelActive: { color: Colors.cyan },

    // Calendar
    calCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    calNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    calMonthLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 15,
      color: theme.textPrimary,
    },
    calWeekRow: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    calDayLabel: {
      flex: 1,
      textAlign: 'center',
      fontFamily: FontFamily.manropeMedium,
      fontSize: 11,
      color: theme.textMuted,
      paddingBottom: 6,
    },
    calCell: {
      flex: 1,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    calCellSelected: {
      backgroundColor: Colors.blue,
      borderRadius: 19,
    },
    calCellAvailable: {
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.35)',
      borderRadius: 19,
    },
    calCellDisabled: { opacity: 0.25 },
    calDayNum: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 13,
      color: theme.textPrimary,
    },
    blockedDot: {
      position: 'absolute',
      bottom: 3,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.negative,
    },
    selectedDateBadge: {
      backgroundColor: 'rgba(45,107,255,0.12)',
      borderRadius: Radius.sm,
      padding: 12,
      alignItems: 'center',
    },
    selectedDateBadgeTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.blueHi,
    },

    // Time slots
    noSlotsBanner: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    noSlotsTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    slotsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    slotChip: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 96,
      alignItems: 'center',
    },
    slotChipActive: {
      backgroundColor: 'rgba(45,224,255,0.12)',
      borderColor: Colors.cyan,
    },
    slotChipLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    slotChipLabelActive: { color: Colors.cyan },
    hintTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },

    // Location
    locationOption: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 6,
    },
    locationOptionActive: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderColor: 'rgba(45,224,255,0.40)',
    },
    locationOptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: {
      borderColor: Colors.cyan,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.cyan,
    },
    locationOptionLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    locationOptionLabelActive: { color: Colors.cyan },
    locationOptionDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      paddingLeft: 30,
    },
    subForm: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    textInput: {
      backgroundColor: theme.pageBg,
      borderRadius: Radius.xs,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },

    // Review step
    summaryCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    packageSection: {
      gap: 8,
    },
    packageSectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
      letterSpacing: 1.0,
    },
    pkgCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      gap: 6,
    },
    pkgCardActive: {
      backgroundColor: 'rgba(45,224,255,0.07)',
      borderColor: 'rgba(45,224,255,0.40)',
    },
    pkgCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pkgRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    pkgRadioDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: Colors.cyan,
    },
    pkgTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    pkgTitleActive: { color: Colors.cyan },
    pkgMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 1,
    },
    pkgPrice: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 16,
      color: theme.textSecondary,
      flexShrink: 0,
    },
    pkgPriceActive: { color: Colors.cyan },
    pkgDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
      paddingLeft: 28,
    },
    notesInput: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      minHeight: 88,
      textAlignVertical: 'top',
    },
    approvalNote: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
    },
    approvalNoteTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
    },

    // Nav footer
    navFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 14,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 12,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 16,
      height: 48,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    backBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    nextBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      height: 48,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
    },
    nextBtnDisabled: {
      backgroundColor: 'rgba(45,107,255,0.35)',
    },
    nextBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },
    submitBtn: {
      flex: 1,
      height: 48,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },

    // Success
    successWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      paddingHorizontal: Spacing.pagePx,
    },
    successCheckmark: {
      fontSize: 52,
      color: Colors.positive,
    },
    successTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: Colors.positive,
    },
    successBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  }), [theme]);
}
