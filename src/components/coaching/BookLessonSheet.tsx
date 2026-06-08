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
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import type { CoachAvailabilitySlot, CoachUnavailabilityBlock, TimeBand } from '@/hooks/useCoachAvailability';
import { TIME_BANDS } from '@/hooks/useCoachAvailability';

const LESSON_TYPES = [
  'Private Lesson',
  'Semi-Private Lesson',
  'Group Clinic',
  'Practice Session',
];

const DURATIONS: { label: string; value: 30 | 60 | 90 }[] = [
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
];

const SKILL_LEVELS: { label: string; value: string }[] = [
  { label: 'Beginner',        value: 'beginner'        },
  { label: 'Intermediate',    value: 'intermediate'     },
  { label: 'High Performance', value: 'high_performance' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export interface BookLessonSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  coachUserId: string;    // coaches.user_id — used as lesson_requests.coach_id
  coachName: string;
  homeBase: string | null;
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks: CoachUnavailabilityBlock[];
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isBlockedDate(date: Date, blocks: CoachUnavailabilityBlock[]): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();

  for (const b of blocks) {
    if (b.recurs_annually) {
      const [,bStartM, bStartD] = b.start_date.split('-').map(Number);
      const [,bEndM,   bEndD]   = b.end_date.split('-').map(Number);
      const val  = m * 100 + d;
      const sval = bStartM * 100 + bStartD;
      const eval_ = bEndM * 100 + bEndD;
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

function hasScheduleOnDate(date: Date, band: TimeBand | null, slots: CoachAvailabilitySlot[]): boolean {
  const dow = date.getDay();
  if (!band) {
    return slots.some(s => s.day_of_week === dow);
  }
  const toMin = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  return slots.some(s => s.day_of_week === dow
    && toMin(s.start_time) < toMin(band.end)
    && toMin(s.end_time) > toMin(band.start),
  );
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
}: BookLessonSheetProps) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [step, setStep] = useState<1|2|3|4>(1);
  const [lessonType, setLessonType] = useState<string | null>(null);
  const [duration, setDuration] = useState<30|60|90|null>(null);
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<TimeBand | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Calendar state
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const cutoff = useMemo(() => { const d = new Date(today); d.setDate(d.getDate()+60); return d; }, [today]);
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const calCells = useMemo((): (Date|null)[] => {
    const first = new Date(calYear, calMonth, 1);
    const pad   = first.getDay();
    const days  = new Date(calYear, calMonth+1, 0).getDate();
    return [...Array(pad).fill(null), ...Array.from({length: days}, (_,i)=>new Date(calYear,calMonth,i+1))];
  }, [calYear, calMonth]);

  const calWeeks = useMemo((): (Date|null)[][] => {
    const weeks: (Date|null)[][] = [];
    for (let i=0; i<calCells.length; i+=7) weeks.push(calCells.slice(i,i+7));
    return weeks;
  }, [calCells]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); }
    else setCalMonth(m=>m-1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0); }
    else setCalMonth(m=>m+1);
  }

  function toggleDate(day: Date) {
    const t = day.getTime();
    const idx = selectedDates.findIndex(d => d.getTime() === t);
    if (idx >= 0) {
      setSelectedDates(prev => prev.filter((_,i) => i !== idx));
    } else if (selectedDates.length < 3) {
      setSelectedDates(prev => [...prev, day]);
    }
  }

  function resetSheet() {
    setStep(1);
    setLessonType(null);
    setDuration(null);
    setSkillLevel(null);
    setSelectedBand(null);
    setSelectedDates([]);
    setNotes('');
    setSubmitting(false);
    setSuccess(false);
  }

  function handleClose() {
    resetSheet();
    onClose();
  }

  function canAdvance(): boolean {
    if (step === 1) return !!lessonType && !!duration && !!skillLevel;
    if (step === 2) return true; // time band optional (soft warning)
    if (step === 3) return selectedDates.length > 0;
    return true;
  }

  function advance() {
    if (!canAdvance()) return;
    if (step < 4) setStep((s) => (s + 1) as 1|2|3|4);
  }

  function goBack() {
    if (step > 1) setStep((s) => (s - 1) as 1|2|3|4);
  }

  async function handleSubmit() {
    if (!lessonType || !duration || !skillLevel || selectedDates.length === 0) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const primaryDate = selectedDates[0];
    const band = selectedBand ?? TIME_BANDS[1]; // default afternoon if none selected
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('lesson_requests')
      .insert({
        coach_id:             coachUserId,
        player_id:            user.id,
        lesson_type:          lessonType,
        duration_minutes:     duration,
        skill_level:          skillLevel,
        sport:                'tennis',
        preferred_date:       isoDate(primaryDate),
        preferred_dates:      selectedDates.map(isoDate),
        preferred_time_start: band.start,
        preferred_time_end:   band.end,
        location:             homeBase,
        notes:                notes.trim() || null,
        status:               'pending',
        expires_at:           expiresAt,
      });

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', 'Could not send request. Please try again.');
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      resetSheet();
      onClose();
      onSuccess();
    }, 1800);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!visible) return null;

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
        {/* Header row */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book a Lesson</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Progress dots */}
        <View style={styles.dots}>
          {([1,2,3,4] as const).map(s => (
            <View key={s} style={[styles.dot, s === step && styles.dotActive, s < step && styles.dotDone]} />
          ))}
        </View>

        {success ? (
          /* ── Success state ── */
          <View style={styles.successWrap}>
            <Text style={styles.successIcon}>✓</Text>
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
                  {LESSON_TYPES.map(lt => (
                    <TouchableOpacity
                      key={lt}
                      style={[styles.option, lessonType === lt && styles.optionActive]}
                      onPress={() => setLessonType(lt)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.optionLabel, lessonType === lt && styles.optionLabelActive]}>
                        {lt}
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

            {/* ── Step 2: Preferred Time ── */}
            {step === 2 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Preferred Time</Text>
                <Text style={styles.stepSubtitle}>
                  Select a preferred time band. The coach will confirm a specific time.
                </Text>
                <View style={styles.gridCard}>
                  <CoachAvailabilityGrid
                    weeklySlots={weeklySlots}
                    unavailabilityBlocks={unavailabilityBlocks}
                    interactive
                    selectedBand={selectedBand}
                    onSelectBand={setSelectedBand}
                  />
                </View>
                {!selectedBand && (
                  <View style={styles.warnBanner}>
                    <Text style={styles.warnTxt}>
                      No time band selected — the coach can choose any available time.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Step 3: Select Dates ── */}
            {step === 3 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Preferred Dates</Text>
                <Text style={styles.stepSubtitle}>
                  Select up to 3 dates ({selectedDates.length}/3). Cyan dots = coach is available.
                </Text>

                {/* Calendar */}
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

                        const isPast    = day < today;
                        const isBeyond  = day > cutoff;
                        const blocked   = isBlockedDate(day, unavailabilityBlocks);
                        const available = hasScheduleOnDate(day, selectedBand, weeklySlots);
                        const isDisabled = isPast || isBeyond;
                        const selIdx    = selectedDates.findIndex(d => d.getTime() === day.getTime());
                        const isSelected = selIdx >= 0;

                        return (
                          <TouchableOpacity
                            key={di}
                            style={[
                              styles.calCell,
                              isSelected && styles.calCellSelected,
                              !isSelected && available && !blocked && styles.calCellAvailable,
                              (isDisabled || blocked) && styles.calCellDisabled,
                            ]}
                            onPress={() => !isDisabled && !blocked && toggleDate(day)}
                            disabled={isDisabled}
                            activeOpacity={0.7}
                          >
                            {isSelected && (
                              <View style={styles.selIdx}>
                                <Text style={styles.selIdxTxt}>{selIdx+1}</Text>
                              </View>
                            )}
                            <Text style={[
                              styles.calDayNum,
                              isSelected && { color: Colors.white },
                              !isSelected && available && !blocked && { color: Colors.cyan },
                              (isDisabled || blocked) && { color: theme.textMuted },
                            ]}>
                              {day.getDate()}
                            </Text>
                            {blocked && !isDisabled && (
                              <View style={styles.blockedDot} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {Array.from({length: 7 - week.length}, (_,i) => <View key={`p${i}`} style={styles.calCell} />)}
                    </View>
                  ))}
                </View>

                {homeBase ? (
                  <View style={styles.locationRow}>
                    <Text style={styles.locationLabel}>Location</Text>
                    <Text style={styles.locationValue}>{homeBase}</Text>
                  </View>
                ) : null}

                {selectedDates.length === 0 && (
                  <Text style={styles.hintTxt}>Tap a date to select it as preferred.</Text>
                )}

                {selectedDates.length > 0 && (
                  <View style={styles.selectedDatesList}>
                    {selectedDates.map((d, i) => (
                      <View key={i} style={styles.selectedDateRow}>
                        <View style={styles.selectedDateIdx}>
                          <Text style={styles.selectedDateIdxTxt}>{i+1}</Text>
                        </View>
                        <Text style={styles.selectedDateTxt}>
                          {d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                        </Text>
                        <TouchableOpacity
                          onPress={() => toggleDate(d)}
                          hitSlop={{top:8,bottom:8,left:8,right:8}}
                        >
                          <X size={14} strokeWidth={2} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── Step 4: Review & Send ── */}
            {step === 4 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepTitle}>Review & Send</Text>

                {/* Summary card */}
                <View style={styles.summaryCard}>
                  <SummaryRow label="Lesson Type"    value={lessonType ?? ''} />
                  <SummaryRow label="Duration"       value={`${duration} min`} />
                  <SummaryRow label="Skill Level"    value={SKILL_LEVELS.find(s=>s.value===skillLevel)?.label ?? ''} />
                  <SummaryRow label="Preferred Time" value={selectedBand ? `${selectedBand.label} (${selectedBand.start}–${selectedBand.end})` : 'No preference'} />
                  <SummaryRow label="Preferred Dates" value={selectedDates.map(d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'})).join(', ')} />
                  {homeBase && <SummaryRow label="Location" value={homeBase} />}
                  <SummaryRow label="Student"        value="Myself" />
                </View>

                {/* Package placeholder */}
                <View style={styles.packagePlaceholder}>
                  <Text style={styles.packagePlaceholderTxt}>
                    Package & payment options — coming soon
                  </Text>
                </View>

                {/* Notes */}
                <Text style={styles.fieldLabel}>Message to Coach (optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any notes, goals, or preferences..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={400}
                />
              </View>
            )}
          </ScrollView>
        )}

        {/* Navigation footer */}
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

            {step < 4 ? (
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.textPrimary, flex: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
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
      borderRadius: 4,
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

    // Lesson type grid
    optionGrid: {
      gap: 8,
    },
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
    optionLabelActive: {
      color: Colors.cyan,
    },

    // Duration / skill level chips
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
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
    chipLabelActive: {
      color: Colors.cyan,
    },

    // Availability grid card
    gridCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
    },
    warnBanner: {
      backgroundColor: 'rgba(214,255,61,0.08)',
      borderRadius: Radius.sm,
      padding: 12,
    },
    warnTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.volt,
    },

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
    calCellDisabled: {
      opacity: 0.25,
    },
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
    selIdx: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: Colors.cyan,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selIdxTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 8,
      color: Colors.midnight,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    locationLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    locationValue: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'right',
    },
    hintTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    selectedDatesList: {
      gap: 8,
    },
    selectedDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedDateIdx: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedDateIdxTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: Colors.white,
    },
    selectedDateTxt: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },

    // Step 4 summary + notes
    summaryCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    packagePlaceholder: {
      padding: 16,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    packagePlaceholderTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
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
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },

    // Success state
    successWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      paddingHorizontal: Spacing.pagePx,
    },
    successIcon: {
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
