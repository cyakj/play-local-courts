import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { WeatherTimeWheel } from '@/components/ui/WeatherTimeWheel';

export interface ClinicFormData {
  id?: string;
  name: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  skillMin: string;
  skillMax: string;
  ageGroup: 'junior' | 'adult' | 'all';
  maxPlayers: string;
  description: string;
  price: string;
  status: 'draft' | 'published';
}

const BLANK: ClinicFormData = {
  name: '',
  date: '',
  startTime: '',
  durationMinutes: 90,
  location: '',
  skillMin: '',
  skillMax: '',
  ageGroup: 'all',
  maxPlayers: '8',
  description: '',
  price: '',
  status: 'published',
};

const DURATIONS = [60, 90, 120];
const AGE_OPTS: { value: ClinicFormData['ageGroup']; label: string }[] = [
  { value: 'all',    label: 'All'     },
  { value: 'junior', label: 'Juniors' },
  { value: 'adult',  label: 'Adults'  },
];

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const QUICK_DATES: { label: string; value: () => string }[] = [
  { label: 'Today',    value: () => localISO(new Date()) },
  { label: 'Tomorrow', value: () => { const d = new Date(); d.setDate(d.getDate() + 1); return localISO(d); } },
];

const TIME_PRESETS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

function fmtTimePreset(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

interface Props {
  visible:   boolean;
  initial?:  Partial<ClinicFormData>;
  onClose:   () => void;
  onSaved:   () => void;
}

export function CreateClinicSheet({ visible, initial, onClose, onSaved }: Props) {
  const { theme } = useTheme();
  const [form, setForm]         = useState<ClinicFormData>({ ...BLANK, ...initial });
  const [saving, setSaving]     = useState(false);
  const [priceError, setPriceError] = useState('');
  const nameRef  = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setForm({ ...BLANK, ...initial });
  }, [visible, initial]);

  // Next 30 days for WTW — computed once per mount
  const clinicDates = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    }),
  []);

  const selectedClinicDate = useMemo(
    () => form.date ? new Date(form.date + 'T12:00:00') : undefined,
    [form.date],
  );

  const set = useCallback(<K extends keyof ClinicFormData>(key: K, val: ClinicFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const isEdit = Boolean(form.id);
  const canSave = form.name.trim() && form.date && form.startTime && form.location.trim();

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        coach_id:         user.id,
        name:             form.name.trim(),
        description:      form.description.trim() || null,
        date:             form.date,
        start_time:       form.startTime,
        duration_minutes: form.durationMinutes,
        location:         form.location.trim(),
        skill_min:        form.skillMin ? Number(form.skillMin) : null,
        skill_max:        form.skillMax ? Number(form.skillMax) : null,
        age_group:        form.ageGroup,
        max_players:      Number(form.maxPlayers) || 8,
        price:            form.price ? Number(form.price) : null,
        status:           form.status,
      };

      if (isEdit && form.id) {
        const { error } = await (supabase as any)
          .from('coach_clinics')
          .update(payload)
          .eq('id', form.id)
          .eq('coach_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('coach_clinics')
          .insert(payload);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('Unable to save clinic', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.backdrop, { backgroundColor: theme.backdrop }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
          <View style={[s.sheet, { backgroundColor: theme.sheetBg }]}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <Text style={[s.title, { color: theme.textPrimary }]}>
                {isEdit ? 'Edit Clinic' : 'New Clinic'}
              </Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <X size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Clinic Name */}
              <Label text="CLINIC NAME" />
              <TextInput
                ref={nameRef}
                style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={form.name}
                onChangeText={v => set('name', v)}
                placeholder="e.g. High Performance Juniors"
                placeholderTextColor={theme.textDisabled}
                maxLength={80}
                returnKeyType="next"
              />

              {/* Date */}
              <Label text="DATE" />
              <View style={s.chipRow}>
                {QUICK_DATES.map(({ label, value: fn }) => {
                  const iso = fn();
                  const active = form.date === iso;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => set('date', iso)}
                      activeOpacity={0.8}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={form.date}
                onChangeText={v => set('date', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textDisabled}
                keyboardType="numbers-and-punctuation"
              />

              {/* Start Time */}
              <Label text="START TIME" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll}>
                <View style={s.timeRow}>
                  {TIME_PRESETS.map(t => {
                    const active = form.startTime === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[s.timeChip, active && s.chipActive]}
                        onPress={() => set('startTime', t)}
                        activeOpacity={0.8}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>
                          {fmtTimePreset(t)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Duration */}
              <Label text="DURATION" />
              <View style={s.chipRow}>
                {DURATIONS.map(d => {
                  const active = form.durationMinutes === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => set('durationMinutes', d)}
                      activeOpacity={0.8}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{d} min</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Location */}
              <Label text="LOCATION" />
              <TextInput
                style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={form.location}
                onChangeText={v => set('location', v)}
                placeholder="Court name or address"
                placeholderTextColor={theme.textDisabled}
                maxLength={120}
              />

              {/* Skill Range */}
              <Label text="NTRP RANGE  (optional)" />
              <View style={s.twoCol}>
                <TextInput
                  style={[s.input, s.halfInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                  value={form.skillMin}
                  onChangeText={v => set('skillMin', v)}
                  placeholder="Min (e.g. 3)"
                  placeholderTextColor={theme.textDisabled}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[s.input, s.halfInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                  value={form.skillMax}
                  onChangeText={v => set('skillMax', v)}
                  placeholder="Max (e.g. 7)"
                  placeholderTextColor={theme.textDisabled}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Age Group */}
              <Label text="AGE GROUP" />
              <View style={s.chipRow}>
                {AGE_OPTS.map(({ value: v, label }) => {
                  const active = form.ageGroup === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => set('ageGroup', v)}
                      activeOpacity={0.8}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Max Players */}
              <Label text="MAX PLAYERS" />
              <TextInput
                style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={form.maxPlayers}
                onChangeText={v => set('maxPlayers', v.replace(/[^0-9]/g, ''))}
                placeholder="8"
                placeholderTextColor={theme.textDisabled}
                keyboardType="number-pad"
              />

              {/* Description */}
              <Label text="DESCRIPTION  (optional)" />
              <TextInput
                style={[s.input, s.textarea, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={form.description}
                onChangeText={v => set('description', v)}
                placeholder="What players should expect, equipment needed, skill requirements…"
                placeholderTextColor={theme.textDisabled}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Price */}
              <Label text="PRICE  (optional)" />
              <View style={[
                s.input, s.currencyRow,
                { paddingHorizontal: 0, borderColor: priceError ? Colors.negative : theme.border, backgroundColor: theme.inputBg },
              ]}>
                <Text style={[s.currencyPrefix, { color: form.price ? theme.textPrimary : theme.textDisabled }]}>$</Text>
                <TextInput
                  style={[s.currencyInput, { color: theme.textPrimary }]}
                  value={form.price}
                  onChangeText={v => {
                    const stripped = v.replace(/[^0-9.]/g, '');
                    const parts = stripped.split('.');
                    const safe = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : stripped;
                    set('price', safe);
                    if (priceError) setPriceError('');
                  }}
                  onBlur={() => {
                    if (!form.price) { setPriceError(''); return; }
                    const num = parseFloat(form.price);
                    if (isNaN(num) || num < 0) {
                      setPriceError('Enter a valid price or leave blank');
                      return;
                    }
                    set('price', num.toFixed(2));
                    setPriceError('');
                  }}
                  placeholder="Leave blank if not yet set"
                  placeholderTextColor={theme.textDisabled}
                  keyboardType="decimal-pad"
                />
              </View>
              {!!priceError && <Text style={s.fieldError}>{priceError}</Text>}

              {/* Status */}
              <Label text="VISIBILITY" />
              <View style={s.chipRow}>
                {(['published', 'draft'] as const).map(st => {
                  const active = form.status === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => set('status', st)}
                      activeOpacity={0.8}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>
                        {st === 'published' ? 'Published' : 'Draft (hidden)'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ height: 32 }} />
            </ScrollView>

            <TouchableOpacity
              style={[s.saveBtn, (!canSave || saving) && s.saveBtnDisabled]}
              onPress={save}
              disabled={!canSave || saving}
              activeOpacity={0.8}>
              <Text style={s.saveBtnText}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Clinic'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text style={s.label}>{text}</Text>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.pagePx,
    paddingTop: 10,
    maxHeight: '95%',
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
  label: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow, color: Colors.fg3,
    letterSpacing: 0.18, marginBottom: 8, marginTop: 6,
  },
  input: {
    minHeight: Spacing.tapTarget, borderWidth: 1, borderRadius: Radius.input,
    paddingHorizontal: 14, fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body, marginBottom: 4,
  },
  textarea: { minHeight: 100, paddingTop: 12 },
  currencyRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: {
    paddingLeft: 14, paddingRight: 4,
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
  },
  currencyInput: {
    flex: 1, paddingLeft: 4, paddingRight: 14,
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
  },
  fieldError: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: 12,
    color: Colors.negative,
    marginTop: 2,
    marginBottom: 4,
  },
  twoCol: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  hScroll: { marginBottom: 4 },
  timeRow: { flexDirection: 'row', gap: 8, paddingRight: Spacing.pagePx, paddingBottom: 8 },
  timeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.chip, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.chip, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  chipActive: {
    backgroundColor: 'rgba(45,224,255,0.10)',
    borderColor: 'rgba(45,224,255,0.35)',
  },
  chipText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label, color: Colors.fg2,
  },
  chipTextActive: { color: Colors.cyan },
  saveBtn: {
    height: 52, backgroundColor: Colors.blue,
    borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body, color: Colors.white,
  },
});
