import { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type {
  DistanceFilterKm, LevelFilter, PriceRange, AvailabilityFilter,
  RatingFilter, ExperienceFilter, LocationModeFilter, GenderFilter, CertificationFilter,
} from '@/hooks/useCoachData';

export const LESSON_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'private_lesson',      label: 'Private Lesson'  },
  { value: 'semi_private_lesson', label: 'Semi-Private'    },
  { value: 'group_lesson',        label: 'Group Lesson'    },
  { value: 'hitting_partner',     label: 'Hitting Partner' },
];

const DISTANCE_OPTIONS: { label: string; value: DistanceFilterKm }[] = [
  { label: '5 mi',  value: 8  },
  { label: '10 mi', value: 16 },
  { label: '25 mi', value: 40 },
  { label: '50 mi', value: 80 },
];

const LEVEL_OPTIONS: { label: string; value: LevelFilter }[] = [
  { label: 'Beginner',        value: 'beginner'        },
  { label: 'Intermediate',    value: 'intermediate'     },
  { label: 'High Performance', value: 'high_performance' },
];

const PRICE_OPTIONS: { label: string; value: PriceRange }[] = [
  { label: 'Any',           value: null       },
  { label: 'Under $75/hr',  value: 'under75'  },
  { label: '$75–$100/hr',   value: '75to100'  },
  { label: '$100–$150/hr',  value: '100to150' },
  { label: '$150+/hr',      value: '150plus'  },
];

const AVAILABILITY_OPTIONS: { label: string; value: AvailabilityFilter }[] = [
  { label: 'Today',     value: 'today'     },
  { label: 'Tomorrow',  value: 'tomorrow'  },
  { label: 'This Week', value: 'this_week' },
  { label: 'Weekend',   value: 'weekend'   },
];

const RATING_OPTIONS: { label: string; value: RatingFilter }[] = [
  { label: 'Any',  value: null  },
  { label: '4.0+', value: '4.0' },
  { label: '4.5+', value: '4.5' },
  { label: '4.8+', value: '4.8' },
];

const EXPERIENCE_OPTIONS: { label: string; value: ExperienceFilter }[] = [
  { label: 'Any',      value: null     },
  { label: '0–2 yrs',  value: '0to2'   },
  { label: '3–5 yrs',  value: '3to5'   },
  { label: '5–10 yrs', value: '5to10'  },
  { label: '10+ yrs',  value: '10plus' },
];

const LOCATION_FILTER_OPTIONS: { label: string; value: LocationModeFilter }[] = [
  { label: 'Either',         value: null              },
  { label: 'Facility Coach', value: 'facility_coach'  },
  { label: 'Travels to You', value: 'traveling_coach' },
];

const GENDER_OPTIONS: { label: string; value: GenderFilter }[] = [
  { label: 'Any',         value: null          },
  { label: 'Male',        value: 'male'        },
  { label: 'Female',      value: 'female'      },
  { label: 'Unspecified', value: 'unspecified' },
];

export interface CoachFiltersState {
  distanceKm:    DistanceFilterKm;
  levels:        LevelFilter[];
  priceRange:    PriceRange;
  lessonTypes:   string[];
  availability:  AvailabilityFilter;
  rating:        RatingFilter;
  experience:    ExperienceFilter;
  locationMode:  LocationModeFilter;
  gender:        GenderFilter;
  certification: CertificationFilter;
}

export const DEFAULT_FILTERS: CoachFiltersState = {
  distanceKm:    null,
  levels:        [],
  priceRange:    null,
  lessonTypes:   [],
  availability:  null,
  rating:        null,
  experience:    null,
  locationMode:  null,
  gender:        null,
  certification: null,
};

export function activeFilterCount(f: CoachFiltersState): number {
  let n = 0;
  if (f.distanceKm   != null)   n++;
  if (f.levels.length > 0)      n += f.levels.length;
  if (f.priceRange   != null)   n++;
  if (f.lessonTypes.length > 0) n += f.lessonTypes.length;
  if (f.availability != null)   n++;
  if (f.rating       != null)   n++;
  if (f.experience   != null)   n++;
  if (f.locationMode != null)   n++;
  if (f.gender       != null)   n++;
  if (f.certification != null)  n++;
  return n;
}

interface Props {
  visible:          boolean;
  onClose:          () => void;
  filters:          CoachFiltersState;
  onApply:          (f: CoachFiltersState) => void;
  playerHasCoords:  boolean;
  resultCount:      number;
}

export function CoachFiltersSheet({ visible, onClose, filters, onApply, playerHasCoords, resultCount }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  // Local draft — only committed on Apply
  const [draft, setDraft] = useState<CoachFiltersState>(filters);

  function open() { setDraft(filters); }

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  function handleReset() {
    setDraft(DEFAULT_FILTERS);
  }

  const draftCount = activeFilterCount(draft);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      onShow={open}
    >
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetTxt}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* ── Distance ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Distance</Text>
            {!playerHasCoords && (
              <Text style={styles.disabledNote}>Location not available — distance filters inactive</Text>
            )}
            <View style={styles.chipRow}>
              {DISTANCE_OPTIONS.map(opt => {
                const active = draft.distanceKm === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive, !playerHasCoords && styles.chipDisabled]}
                    onPress={() => playerHasCoords && setDraft(d => ({ ...d, distanceKm: d.distanceKm === opt.value ? null : opt.value }))}
                    activeOpacity={playerHasCoords ? 0.75 : 1}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive, !playerHasCoords && styles.chipLabelDisabled]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Skill Level ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Skill Level</Text>
            <View style={styles.chipRow}>
              {LEVEL_OPTIONS.map(opt => {
                const active = draft.levels.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, levels: toggle(d.levels, opt.value) }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Price Range ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Price Range</Text>
            <View style={styles.chipRow}>
              {PRICE_OPTIONS.map(opt => {
                const active = draft.priceRange === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, priceRange: opt.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Lesson Type ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Lesson Type</Text>
            <View style={styles.chipRow}>
              {LESSON_TYPE_OPTIONS.map(o => {
                const active = draft.lessonTypes.includes(o.value);
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(s => ({
                      ...s,
                      lessonTypes: active
                        ? s.lessonTypes.filter(v => v !== o.value)
                        : [...s.lessonTypes, o.value],
                    }))}
                    activeOpacity={0.7}>
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Availability ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Availability</Text>
            <View style={styles.chipRow}>
              {AVAILABILITY_OPTIONS.map(opt => {
                const active = draft.availability === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, availability: d.availability === opt.value ? null : opt.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Rating ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rating</Text>
            <View style={styles.chipRow}>
              {RATING_OPTIONS.map(opt => {
                const active = draft.rating === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, rating: opt.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Years of Experience ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Years of Experience</Text>
            <View style={styles.chipRow}>
              {EXPERIENCE_OPTIONS.map(opt => {
                const active = draft.experience === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, experience: opt.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Location Mode ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location</Text>
            <View style={styles.chipRow}>
              {LOCATION_FILTER_OPTIONS.map(opt => {
                const active = draft.locationMode === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, locationMode: opt.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Gender ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Coach Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map(opt => {
                const active = draft.gender === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, gender: opt.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Certification ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Certification</Text>
            <View style={styles.chipRow}>
              {([
                { label: 'Any',       value: null          as CertificationFilter },
                { label: 'Certified', value: 'certified'   as CertificationFilter },
              ] as const).map(o => (
                <TouchableOpacity
                  key={String(o.value)}
                  style={[styles.chip, draft.certification === o.value && styles.chipActive]}
                  onPress={() => setDraft(s => ({ ...s, certification: o.value }))}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipLabel, draft.certification === o.value && styles.chipLabelActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Apply footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
            <Text style={styles.applyBtnLabel}>
              {resultCount > 0
                ? `Show ${resultCount} coach${resultCount === 1 ? '' : 'es'}`
                : draftCount > 0 ? 'Apply Filters' : 'Apply'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    resetTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
    body: {
      paddingBottom: 24,
    },
    section: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 22,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: 20,
    },
    sectionLabel: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    disabledNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      fontStyle: 'italic',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.40)',
    },
    chipDisabled: {
      opacity: 0.35,
    },
    chipLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipLabelActive: {
      color: Colors.cyan,
    },
    chipLabelDisabled: {
      color: theme.textMuted,
    },
    footer: {
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 16,
      paddingBottom: 36,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    applyBtn: {
      height: 52,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },
  }), [theme]);
}
