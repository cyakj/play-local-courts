import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachAvailabilitySlot } from '@/hooks/useCoachAvailability';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

const LOCATION_MODES = [
  { value: 'coach_facility', label: 'My Facility' },
  { value: 'traveling',      label: 'Traveling' },
  { value: 'both',           label: 'Either' },
];

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

interface Props {
  slots: CoachAvailabilitySlot[];
  onRefresh: () => void;
}

export function CoachAvailabilityEditor({ slots, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();

  const [showModal, setShowModal]     = useState(false);
  const [editingSlot, setEditingSlot] = useState<CoachAvailabilitySlot | null>(null);
  const [newDay, setNewDay]           = useState(1);
  const [newStart, setNewStart]       = useState('09:00');
  const [newEnd, setNewEnd]           = useState('12:00');
  const [newLocation, setNewLocation] = useState<string>('coach_facility');
  const [saving, setSaving]           = useState(false);

  const grouped = useMemo(() => {
    const g: Record<number, CoachAvailabilitySlot[]> = {};
    slots.forEach(s => {
      if (!g[s.day_of_week]) g[s.day_of_week] = [];
      g[s.day_of_week].push(s);
    });
    return g;
  }, [slots]);

  function openAdd() {
    setEditingSlot(null);
    setNewDay(1);
    setNewStart('09:00');
    setNewEnd('12:00');
    setNewLocation('coach_facility');
    setShowModal(true);
  }

  function openEdit(slot: CoachAvailabilitySlot) {
    setEditingSlot(slot);
    setNewDay(slot.day_of_week);
    setNewStart(normalizeTime(slot.start_time));
    setNewEnd(normalizeTime(slot.end_time));
    setNewLocation(slot.location_mode ?? 'coach_facility');
    setShowModal(true);
  }

  function openCopy(slot: CoachAvailabilitySlot) {
    setEditingSlot(null);
    setNewDay(slot.day_of_week);
    setNewStart(normalizeTime(slot.start_time));
    setNewEnd(normalizeTime(slot.end_time));
    setNewLocation(slot.location_mode ?? 'coach_facility');
    setShowModal(true);
  }

  async function handleDelete(slot: CoachAvailabilitySlot) {
    Alert.alert(
      'Remove Slot',
      `Remove ${DAY_NAMES[slot.day_of_week]} ${fmtTime(normalizeTime(slot.start_time))} – ${fmtTime(normalizeTime(slot.end_time))}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('coach_availability').delete().eq('id', slot.id);
            if (error) { Alert.alert('Error', error.message); return; }
            onRefresh();
          },
        },
      ],
    );
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (editingSlot) {
      // Delete old row, then insert new one (handles key changes)
      const { error: delErr } = await supabase.from('coach_availability').delete().eq('id', editingSlot.id);
      if (delErr) { setSaving(false); Alert.alert('Error', delErr.message); return; }
    }

    const { error } = await supabase
      .from('coach_availability')
      .upsert(
        { coach_id: user.id, day_of_week: newDay, start_time: newStart, end_time: newEnd, location_mode: newLocation },
        { onConflict: 'coach_id,day_of_week,start_time' },
      );

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    onRefresh();
  }

  const isEditing = editingSlot != null;
  const modalTitle = isEditing ? 'Edit Availability Slot' : 'Add Availability Slot';
  const saveLabel  = saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Slot';

  const validStart = TIME_OPTIONS.filter(t => t < newEnd);
  const validEnd   = TIME_OPTIONS.filter(t => t > newStart);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>AVAILABILITY</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={openAdd}
          activeOpacity={0.8}>
          <Plus size={14} color={Colors.blue} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add Slot</Text>
        </TouchableOpacity>
      </View>

      {slots.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No availability slots yet.</Text>
          <Text style={styles.emptySubText}>Tap "Add Slot" to set your weekly availability.</Text>
        </View>
      ) : (
        [0, 1, 2, 3, 4, 5, 6].filter(d => grouped[d]).map(d => (
          <View key={d} style={styles.dayGroup}>
            <Text style={styles.dayLabel}>{DAY_NAMES[d]}</Text>
            {grouped[d].map(slot => (
              <View key={slot.id} style={styles.slotRow}>
                <View style={styles.slotInfo}>
                  <Text style={styles.slotTime}>
                    {fmtTime(normalizeTime(slot.start_time))} – {fmtTime(normalizeTime(slot.end_time))}
                  </Text>
                  <Text style={styles.slotLocation}>
                    {LOCATION_MODES.find(m => m.value === slot.location_mode)?.label ?? slot.location_mode ?? '—'}
                  </Text>
                </View>
                <View style={styles.slotActions}>
                  <TouchableOpacity
                    onPress={() => openCopy(slot)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}>
                    <Copy size={14} color={Colors.fg2} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openEdit(slot)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}>
                    <Pencil size={14} color={Colors.fg2} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(slot)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}>
                    <Trash2 size={14} color={Colors.negative} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{modalTitle}</Text>

          <Text style={styles.fieldLabel}>DAY OF WEEK</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {[0, 1, 2, 3, 4, 5, 6].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, newDay === d && styles.chipActive]}
                onPress={() => setNewDay(d)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, newDay === d && styles.chipTextActive]}>{DAY_SHORT[d]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>START TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {validStart.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, newStart === t && styles.chipActive]}
                onPress={() => setNewStart(t)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, newStart === t && styles.chipTextActive]}>{fmtTime(t)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>END TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {validEnd.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, newEnd === t && styles.chipActive]}
                onPress={() => setNewEnd(t)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, newEnd === t && styles.chipTextActive]}>{fmtTime(t)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>LOCATION</Text>
          <View style={styles.chipRow}>
            {LOCATION_MODES.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.chip, newLocation === m.value && styles.chipActive]}
                onPress={() => setNewLocation(m.value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, newLocation === m.value && styles.chipTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container: { gap: 12 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(45,107,255,0.35)',
      backgroundColor: 'rgba(45,107,255,0.08)',
    },
    addBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
    },
    emptyCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 6,
    },
    emptyText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    emptySubText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    dayGroup: { gap: 6 },
    dayLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    slotInfo: { flex: 1, gap: 2 },
    slotTime: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    slotLocation: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    slotActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingLeft: 8,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 12,
      gap: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
      marginTop: 4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.15)',
    },
    chipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipTextActive: {
      color: Colors.blue,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#FFFFFF',
    },
  }), [theme]);
}
