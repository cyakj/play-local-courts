import { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { TimePicker } from '@/components/ui/TimePicker';
import { RulesSummary } from '@/components/ui/RulesSummary';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';

type AmenityRules = Database['public']['Tables']['amenity_rules']['Row'];

// Mirrors COURT_TYPES in src/app/(admin)/manage-amenities.tsx — kept in sync manually
// since that screen does not export the list and this file must not modify it.
const COURT_TYPES = [
  'tennis',
  'pickleball',
  'pool',
  'gym',
  'clubhouse',
  'barbecue',
  'jacuzzi',
] as const;

type CourtTypeValue = (typeof COURT_TYPES)[number];

const STEPS = ['Basics', 'Hours', 'Rules', 'Review'] as const;
type StepKey = (typeof STEPS)[number];

const RULE_DEFAULTS = {
  duration: 60,
  advanceDays: 14,
  cancellationHours: 2,
  maxPerDay: 1,
};

interface AddAmenityWizardProps {
  visible: boolean;
  onClose: () => void;
  hoaId: string;
  theme: ThemeTokens;
  onCreated: () => void;
}

export function AddAmenityWizard({ visible, onClose, hoaId, theme, onCreated }: AddAmenityWizardProps) {
  const styles = useStyles(theme);

  const [stepIndex, setStepIndex] = useState(0);

  // Basics
  const [name, setName] = useState('');
  const [type, setType] = useState<CourtTypeValue>('tennis');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [active, setActive] = useState(true);

  // Hours
  const [openTime, setOpenTime] = useState<string | null>(null);
  const [closeTime, setCloseTime] = useState<string | null>(null);

  // Rules
  const [duration, setDuration] = useState(RULE_DEFAULTS.duration);
  const [advanceDays, setAdvanceDays] = useState(RULE_DEFAULTS.advanceDays);
  const [cancellationHours, setCancellationHours] = useState(RULE_DEFAULTS.cancellationHours);
  const [maxPerDay, setMaxPerDay] = useState(RULE_DEFAULTS.maxPerDay);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [saving, setSaving] = useState(false);

  const step: StepKey = STEPS[stepIndex];

  function resetState() {
    setStepIndex(0);
    setName('');
    setType('tennis');
    setDescription('');
    setCapacity('');
    setActive(true);
    setOpenTime(null);
    setCloseTime(null);
    setDuration(RULE_DEFAULTS.duration);
    setAdvanceDays(RULE_DEFAULTS.advanceDays);
    setCancellationHours(RULE_DEFAULTS.cancellationHours);
    setMaxPerDay(RULE_DEFAULTS.maxPerDay);
    setRequiresApproval(false);
    setSaving(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'Basics':
        return name.trim().length > 0;
      case 'Hours':
        return !!openTime && !!closeTime;
      case 'Rules':
      case 'Review':
        return true;
      default:
        return false;
    }
  }

  function goNext() {
    if (!canAdvance()) return;
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  const previewRules: Partial<AmenityRules> = {
    booking_start_time: openTime,
    booking_end_time: closeTime,
    max_duration_minutes: duration,
    advance_booking_days: advanceDays,
    min_cancellation_hours: cancellationHours,
    max_reservations_per_day: maxPerDay,
    requires_admin_approval: requiresApproval,
  };

  async function handleCreate() {
    if (!name.trim() || !openTime || !closeTime) return;
    setSaving(true);

    const { data: court, error: courtError } = await supabase
      .from('courts')
      .insert({
        name: name.trim(),
        court_type: type,
        hoa_id: hoaId,
        capacity: capacity.trim() ? Number(capacity.trim()) : null,
        description: description.trim() || null,
        is_active: active,
      })
      .select()
      .single();

    if (courtError || !court) {
      setSaving(false);
      Alert.alert('Could Not Create Amenity', courtError?.message ?? 'Unknown error creating amenity.');
      return;
    }

    const { error: rulesError } = await supabase.from('amenity_rules').insert({
      hoa_id: hoaId,
      amenity_id: court.id,
      booking_start_time: openTime,
      booking_end_time: closeTime,
      max_duration_minutes: duration,
      advance_booking_days: advanceDays,
      min_cancellation_hours: cancellationHours,
      max_reservations_per_day: maxPerDay,
      requires_admin_approval: requiresApproval,
    });

    setSaving(false);

    if (rulesError) {
      Alert.alert('Booking Rules Not Saved', `${rulesError.message} (amenity was created — finish setup from Manage Amenities)`);
      return;
    }

    onCreated();
    resetState();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Amenity</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={theme.textMuted} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.stepIndicatorWrap}>
          <View style={styles.stepRow}>
            {STEPS.map((s, i) => (
              <Fragment key={s}>
                <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}>
                  <Text style={[styles.stepDotLabel, i <= stepIndex && styles.stepDotLabelActive]}>
                    {i + 1}
                  </Text>
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepConnector, i < stepIndex && styles.stepConnectorActive]} />
                )}
              </Fragment>
            ))}
          </View>
          <Text style={styles.stepCaption}>
            STEP {stepIndex + 1} OF {STEPS.length} · {step.toUpperCase()}
          </Text>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled">

          {step === 'Basics' && (
            <View>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Court 1, Main Pool…"
                placeholderTextColor={theme.textMuted}
                autoFocus
              />

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>TYPE</Text>
              <View style={styles.typeGrid}>
                {COURT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, type === t && styles.typePillActive]}
                    onPress={() => setType(t)}>
                    <Text style={[styles.typePillLabel, type === t && styles.typePillLabelActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Notes visible to admins about this amenity"
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>CAPACITY (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="e.g. 4"
                keyboardType="number-pad"
                placeholderTextColor={theme.textMuted}
              />

              <View style={[styles.switchRow, { marginTop: 20 }]}>
                <Text style={styles.switchLabel}>Available for booking</Text>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ false: theme.border, true: Colors.accentCyan }}
                />
              </View>
            </View>
          )}

          {step === 'Hours' && (
            <View>
              <Text style={styles.helperText}>
                Residents can only book this amenity within the hours you set here. Both times are
                required before you can continue.
              </Text>
              <View style={{ marginTop: 16 }}>
                <TimePicker value={openTime} onChange={setOpenTime} theme={theme} label="OPEN TIME" />
              </View>
              <View style={{ marginTop: 16 }}>
                <TimePicker value={closeTime} onChange={setCloseTime} theme={theme} label="CLOSE TIME" />
              </View>
            </View>
          )}

          {step === 'Rules' && (
            <View style={{ gap: 20 }}>
              <Stepper
                label="BOOKING DURATION"
                value={duration}
                onChange={setDuration}
                min={15}
                max={240}
                step={15}
                unit="min"
                theme={theme}
              />
              <Stepper
                label="ADVANCE BOOKING WINDOW"
                value={advanceDays}
                onChange={setAdvanceDays}
                min={1}
                max={90}
                step={1}
                unit="days"
                theme={theme}
              />
              <Stepper
                label="CANCELLATION WINDOW"
                value={cancellationHours}
                onChange={setCancellationHours}
                min={0}
                max={72}
                step={1}
                unit="hrs"
                theme={theme}
              />
              <Stepper
                label="MAX RESERVATIONS / DAY"
                value={maxPerDay}
                onChange={setMaxPerDay}
                min={1}
                max={10}
                step={1}
                theme={theme}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Requires admin approval</Text>
                <Switch
                  value={requiresApproval}
                  onValueChange={setRequiresApproval}
                  trackColor={{ false: theme.border, true: Colors.accentCyan }}
                />
              </View>
            </View>
          )}

          {step === 'Review' && (
            <View>
              <Text style={styles.sectionTitle}>Amenity</Text>
              <View style={styles.reviewCard}>
                <Text style={styles.reviewName}>{name.trim() || 'Untitled amenity'}</Text>
                <Text style={styles.reviewMeta}>
                  {type.toUpperCase()}
                  {capacity.trim() ? ` · CAP ${capacity.trim()}` : ''}
                  {active ? ' · Bookable' : ' · Not bookable yet'}
                </Text>
                {description.trim() ? (
                  <Text style={styles.reviewDesc}>{description.trim()}</Text>
                ) : null}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Booking Rules</Text>
              <RulesSummary rules={previewRules} theme={theme} />

              <View style={styles.modalActions}>
                <Button
                  variant="primary"
                  label="Create Amenity"
                  onPress={handleCreate}
                  loading={saving}
                  fullWidth
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerBackBtn, stepIndex === 0 && styles.footerBackBtnDisabled]}
            onPress={goBack}
            disabled={stepIndex === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.footerBackText, stepIndex === 0 && styles.footerBackTextDisabled]}>
              Back
            </Text>
          </TouchableOpacity>
          {step !== 'Review' && (
            <View style={{ flex: 1 }}>
              <Button
                variant="primary"
                label="Next"
                onPress={goNext}
                disabled={!canAdvance()}
                fullWidth
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    modal: { flex: 1, backgroundColor: theme.cardBg },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.pagePx,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontFamily: FontFamily.manropeExtraBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      flex: 1,
      marginRight: 12,
    },

    stepIndicatorWrap: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    stepRow: { flexDirection: 'row', alignItems: 'center' },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stepDotActive: {
      backgroundColor: Colors.blue,
      borderColor: Colors.blue,
    },
    stepDotLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
    },
    stepDotLabelActive: { color: Colors.white },
    stepConnector: {
      flex: 1,
      height: 2,
      backgroundColor: theme.border,
      marginHorizontal: 6,
    },
    stepConnectorActive: { backgroundColor: Colors.blue },
    stepCaption: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1,
      marginTop: 10,
    },

    modalScroll: { flex: 1 },
    modalContent: {
      padding: Spacing.pagePx,
      paddingBottom: 40,
    },

    sectionTitle: {
      fontFamily: FontFamily.manropeExtraBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      marginBottom: 12,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.input,
      padding: 14,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      backgroundColor: theme.pageBg,
    },
    textArea: { minHeight: 72 },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typePill: {
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
    },
    typePillActive: {
      backgroundColor: Colors.navy,
      borderColor: Colors.navy,
    },
    typePillLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textMuted,
    },
    typePillLabelActive: { color: Colors.white },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textPrimary,
    },

    helperText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
    },

    reviewCard: {
      backgroundColor: theme.surface2,
      borderRadius: Radius.card,
      padding: 14,
      gap: 4,
    },
    reviewName: {
      fontFamily: FontFamily.manropeBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    reviewMeta: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1,
    },
    reviewDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      marginTop: 4,
    },

    modalActions: { marginTop: 24 },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: Spacing.pagePx,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerBackBtn: {
      minHeight: Spacing.tapTarget,
      paddingHorizontal: 20,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerBackBtnDisabled: { opacity: 0.4 },
    footerBackText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 16,
      color: theme.textPrimary,
    },
    footerBackTextDisabled: { color: theme.textMuted },
  }), [theme]);
}
