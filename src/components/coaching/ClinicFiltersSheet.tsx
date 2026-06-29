import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

export interface ClinicFilters {
  dateMode:    'today' | 'tomorrow' | 'other' | null;
  otherDate:   string | null;
  distanceMax: 5 | 10 | 20 | 35 | null;
  ntrpPreset:  'any' | '2.0-2.5' | '3.0-3.5' | '4.0-4.5' | '5.0+';
  ageGroup:    'junior' | 'adult' | 'all';
  timeOfDay:   'any' | 'morning' | 'afternoon' | 'evening';
  clinicType:  'all' | 'group' | 'high_performance' | 'junior_academy' | 'cardio';
  spotsOnly:   boolean;
}

export const DEFAULT_CLINIC_FILTERS: ClinicFilters = {
  dateMode:    null,
  otherDate:   null,
  distanceMax: 20,
  ntrpPreset:  'any',
  ageGroup:    'all',
  timeOfDay:   'any',
  clinicType:  'all',
  spotsOnly:   false,
};

export function clinicActiveFilterCount(f: ClinicFilters): number {
  let n = 0;
  if (f.dateMode    !== null)  n++;
  if (f.distanceMax !== 20)    n++;
  if (f.ntrpPreset  !== 'any') n++;
  if (f.ageGroup    !== 'all') n++;
  if (f.timeOfDay   !== 'any') n++;
  if (f.clinicType  !== 'all') n++;
  if (f.spotsOnly)              n++;
  return n;
}

// ─── option lists ────────────────────────────────────────────────────────────

const DATE_OPTS = [
  { value: 'today'    as const, label: 'Today'       },
  { value: 'tomorrow' as const, label: 'Tomorrow'    },
  { value: 'other'    as const, label: 'Other Dates' },
] satisfies { value: NonNullable<ClinicFilters['dateMode']>; label: string }[];

const DISTANCE_STR_MAP: Record<string, 5 | 10 | 20 | 35 | null> = {
  '5': 5, '10': 10, '20': 20, '35': 35, 'anywhere': null,
};
const DISTANCE_OPTS = [
  { value: '5'       , label: '5 mi'    },
  { value: '10'      , label: '10 mi'   },
  { value: '20'      , label: '20 mi'   },
  { value: '35'      , label: '35 mi'   },
  { value: 'anywhere', label: 'Anywhere'},
];

const NTRP_OPTS = [
  { value: 'any'     as const, label: 'Any level'    },
  { value: '2.0-2.5' as const, label: 'NTRP 2.0–2.5' },
  { value: '3.0-3.5' as const, label: 'NTRP 3.0–3.5' },
  { value: '4.0-4.5' as const, label: 'NTRP 4.0–4.5' },
  { value: '5.0+'    as const, label: 'NTRP 5.0+'    },
];

const AGE_OPTS = [
  { value: 'all'    as const, label: 'All Ages' },
  { value: 'junior' as const, label: 'Juniors'  },
  { value: 'adult'  as const, label: 'Adults'   },
];

const TIME_OPTS = [
  { value: 'any'       as const, label: 'Any Time'  },
  { value: 'morning'   as const, label: 'Morning'   },
  { value: 'afternoon' as const, label: 'Afternoon' },
  { value: 'evening'   as const, label: 'Evening'   },
];

const TYPE_OPTS = [
  { value: 'all'              as const, label: 'All Clinics'      },
  { value: 'group'            as const, label: 'Group Clinic'     },
  { value: 'high_performance' as const, label: 'High Performance' },
  { value: 'junior_academy'   as const, label: 'Junior Academy'   },
  { value: 'cardio'           as const, label: 'Cardio Tennis'    },
];

function getOtherDates(): Array<{ iso: string; label: string }> {
  const result: Array<{ iso: string; label: string }> = [];
  for (let i = 2; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    result.push({ iso, label });
  }
  return result;
}

function distanceToStr(v: 5 | 10 | 20 | 35 | null): string {
  return v == null ? 'anywhere' : String(v);
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: ClinicFilters;
  onApply: (f: ClinicFilters) => void;
}

export function ClinicFiltersSheet({ visible, onClose, filters, onApply }: Props) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<ClinicFilters>(filters);

  function handleOpen() { setDraft(filters); }
  function reset()       { setDraft(DEFAULT_CLINIC_FILTERS); }
  function apply()       { onApply(draft); onClose(); }

  const otherDates = getOtherDates();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}>
      <View style={[s.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={[s.sheet, { backgroundColor: theme.sheetBg }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={[s.title, { color: theme.textPrimary }]}>Filter Clinics</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <X size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* 1. DATE */}
            <SectionLabel text="DATE" />
            <View style={s.chipRow}>
              {DATE_OPTS.map(opt => {
                const active = draft.dateMode === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() =>
                      setDraft(p => ({
                        ...p,
                        dateMode: active ? null : opt.value,
                        otherDate: opt.value !== 'other' ? null : p.otherDate,
                      }))
                    }
                    activeOpacity={0.8}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {draft.dateMode === 'other' && (
              <View style={[s.chipRow, { marginTop: -8 }]}>
                {otherDates.map(({ iso, label }) => {
                  const active = draft.otherDate === iso;
                  return (
                    <TouchableOpacity
                      key={iso}
                      style={[s.chip, s.chipSm, active && s.chipActive]}
                      onPress={() => setDraft(p => ({ ...p, otherDate: active ? null : iso }))}
                      activeOpacity={0.8}>
                      <Text style={[s.chipTextSm, active && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 2. DISTANCE */}
            <SectionLabel text="DISTANCE" />
            <ChipGroup
              options={DISTANCE_OPTS}
              value={distanceToStr(draft.distanceMax)}
              onChange={v => setDraft(p => ({ ...p, distanceMax: DISTANCE_STR_MAP[v] ?? 20 }))}
            />

            {/* 3. NTRP LEVEL */}
            <SectionLabel text="NTRP LEVEL" />
            <ChipGroup
              options={NTRP_OPTS}
              value={draft.ntrpPreset}
              onChange={v => setDraft(p => ({ ...p, ntrpPreset: v }))}
            />

            {/* 4. AGE GROUP */}
            <SectionLabel text="AGE GROUP" />
            <ChipGroup
              options={AGE_OPTS}
              value={draft.ageGroup}
              onChange={v => setDraft(p => ({ ...p, ageGroup: v }))}
            />

            {/* 5. TIME */}
            <SectionLabel text="TIME" />
            <ChipGroup
              options={TIME_OPTS}
              value={draft.timeOfDay}
              onChange={v => setDraft(p => ({ ...p, timeOfDay: v }))}
            />

            {/* 6. CLINIC TYPE */}
            <SectionLabel text="CLINIC TYPE" />
            <ChipGroup
              options={TYPE_OPTS}
              value={draft.clinicType}
              onChange={v => setDraft(p => ({ ...p, clinicType: v }))}
            />

            {/* 7. AVAILABILITY */}
            <SectionLabel text="AVAILABILITY" />
            <TouchableOpacity
              style={[s.toggleRow, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
              onPress={() => setDraft(p => ({ ...p, spotsOnly: !p.spotsOnly }))}>
              <Text style={[s.toggleLabel, { color: theme.textPrimary }]}>Spots available only</Text>
              <ToggleControl on={draft.spotsOnly} />
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.resetBtn, { borderColor: theme.border }]}
              onPress={reset}>
              <Text style={[s.resetTxt, { color: theme.textSecondary }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={apply}>
              <Text style={s.applyTxt}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.chipRow}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}>
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ToggleControl({ on }: { on: boolean }) {
  return (
    <View style={[s.toggle, on && s.toggleOn]}>
      <View style={[s.thumb, on && s.thumbOn]} />
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.pagePx,
    paddingTop: 10,
    maxHeight: '92%',
  },
  handle: {
    width: 42, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: Colors.fg3,
    letterSpacing: 0.18,
    marginBottom: 10,
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.chip, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: {
    backgroundColor: 'rgba(45,224,255,0.10)',
    borderColor: 'rgba(45,224,255,0.35)',
  },
  chipText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.fg2,
  },
  chipTextSm: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: 12,
    color: Colors.fg2,
  },
  chipTextActive: { color: Colors.cyan },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 8,
  },
  toggleLabel: {
    flex: 1,
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
  },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: Colors.borderStrong,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: Colors.cyan },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.fg3 },
  thumbOn: { backgroundColor: Colors.pageBg, alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  resetBtn: {
    flex: 1, height: 50, borderWidth: 1,
    borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center',
  },
  resetTxt: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  applyBtn: {
    flex: 2, height: 50, backgroundColor: Colors.blue,
    borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center',
  },
  applyTxt: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body, color: Colors.white,
  },
});
