import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type CourtMaintenance = Database['public']['Tables']['court_maintenance']['Row'];

const AMENITY_TYPES = [
  { value: 'tennis', label: 'Tennis' },
  { value: 'pickleball', label: 'Pickleball' },
  { value: 'pool', label: 'Pool' },
  { value: 'gym', label: 'Gym' },
  { value: 'clubhouse', label: 'Clubhouse' },
  { value: 'barbecue', label: 'Barbecue' },
  { value: 'jacuzzi', label: 'Jacuzzi' },
] as const;
type CourtTypeValue = (typeof AMENITY_TYPES)[number]['value'];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86400000);
}
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDateLabel(date: Date): string {
  return `${DAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 19; h++) {
  TIME_SLOTS.push(h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
}

function slotToHour(slot: string): number {
  const isPm = slot.endsWith('pm');
  const num = parseInt(slot.replace(/[ap]m/, ''), 10);
  if (isPm && num !== 12) return num + 12;
  if (!isPm && num === 12) return 0;
  return num;
}

type SlotStatus = 'available' | 'booked' | 'maintenance';

export default function ManageCourtsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { hoaId } = useLocalSearchParams<{ hoaId: string }>();

  const [courts, setCourts] = useState<Court[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CourtTypeValue>('tennis');
  const [saving, setSaving] = useState(false);

  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenance, setMaintenance] = useState<CourtMaintenance[]>([]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));

  const slotColors = useMemo<Record<SlotStatus, { bg: string; border: string; text: string }>>(() => ({
    available: { bg: 'rgba(154,163,184,0.08)', border: 'rgba(154,163,184,0.20)', text: theme.textSecondary },
    booked: { bg: 'rgba(255,92,107,0.12)', border: 'rgba(255,92,107,0.40)', text: Colors.negative },
    maintenance: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.40)', text: '#F59E0B' },
  }), [theme]);

  async function loadCourts() {
    let query = supabase.from('courts').select('*').order('name', { ascending: true });
    if (hoaId) query = query.eq('hoa_id', hoaId);
    const { data } = await query;
    setCourts(data ?? []);
  }

  async function loadSlots() {
    if (!selectedCourtId) return;
    const dateStr = toDateString(selectedDate);
    const [bookingRes, maintenanceRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('court_id', selectedCourtId).eq('date', dateStr),
      supabase.from('court_maintenance').select('*').eq('court_id', selectedCourtId).eq('date', dateStr),
    ]);
    setBookings(bookingRes.data ?? []);
    setMaintenance(maintenanceRes.data ?? []);
  }

  useEffect(() => { loadCourts(); }, []);
  useEffect(() => { loadSlots(); }, [selectedCourtId, selectedDate]);

  function getSlotStatus(slot: string): SlotStatus {
    const hour = slotToHour(slot);
    const slotTime = `${String(hour).padStart(2, '0')}:00:00`;
    for (const m of maintenance) {
      if (slotTime >= m.start_time.substring(0, 8) && slotTime < m.end_time.substring(0, 8)) return 'maintenance';
    }
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      if (slotTime >= b.start_time.substring(0, 8) && slotTime < b.end_time.substring(0, 8)) return 'booked';
    }
    return 'available';
  }

  async function toggleMaintenance(slot: string, isMaintenance: boolean) {
    const hour = slotToHour(slot);
    const startTime = `${String(hour).padStart(2, '0')}:00:00`;
    const endTime = `${String(hour + 1).padStart(2, '0')}:00:00`;
    const dateStr = toDateString(selectedDate);
    if (isMaintenance) {
      await supabase.from('court_maintenance')
        .delete()
        .eq('court_id', selectedCourtId)
        .eq('date', dateStr)
        .eq('start_time', startTime);
    } else {
      await supabase.from('court_maintenance')
        .insert({ court_id: selectedCourtId, date: dateStr, start_time: startTime, end_time: endTime });
    }
    loadSlots();
  }

  async function addCourt() {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from('courts').insert({
      name: newName.trim(),
      court_type: newType,
      hoa_id: hoaId ?? '',
    });
    setSaving(false);
    setShowAddForm(false);
    setNewName('');
    setNewType('tennis');
    loadCourts();
  }

  function confirmDelete(court: Court) {
    Alert.alert(
      'Remove Amenity',
      `Remove "${court.name}"? All bookings will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteCourt(court.id) },
      ],
    );
  }

  async function deleteCourt(id: string) {
    if (selectedCourtId === id) setSelectedCourtId('');
    await supabase.from('courts').delete().eq('id', id);
    loadCourts();
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Manage Amenities" onBack={() => router.back()} />

      {/* Hero section */}
      <View style={styles.hero}>
        <Text style={styles.heroTag}>ADMIN</Text>
        <Text style={styles.heroTitle}>Manage Amenities</Text>
        <Text style={styles.heroSub}>
          Add, remove, and schedule maintenance for your community amenities.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Add New Amenity — dashed card or inline form */}
          {!showAddForm ? (
            <TouchableOpacity
              style={styles.addDashedCard}
              onPress={() => setShowAddForm(true)}
              activeOpacity={0.8}>
              <Plus color={Colors.accentCyan} size={20} strokeWidth={1.5} />
              <Text style={styles.addDashedLabel}>Add New Amenity</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addFormCard}>
              <Text style={styles.addFormTitle}>New Amenity</Text>

              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.textInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g., Tennis Court 3, Pool Area"
                placeholderTextColor={theme.textMuted}
                autoFocus
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TYPE</Text>
              <View style={styles.typeGrid}>
                {AMENITY_TYPES.map((t) => {
                  const active = newType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.typePill, active && styles.typePillActive]}
                      onPress={() => setNewType(t.value)}>
                      <Text style={[styles.typePillLabel, active && styles.typePillLabelActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowAddForm(false); setNewName(''); setNewType('tennis'); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addBtn, (!newName.trim() || saving) && styles.addBtnDisabled]}
                  onPress={addCourt}
                  disabled={!newName.trim() || saving}>
                  <Text style={styles.addBtnText}>{saving ? 'Adding…' : 'Add Amenity'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Current Amenities section */}
          {courts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Current Amenities</Text>

              {/* Date selector */}
              <Text style={styles.dateSelectorLabel}>SELECT DATE FOR MAINTENANCE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateRow}
                style={styles.dateScroll}>
                {days.map((d) => {
                  const isSelected = toDateString(d) === toDateString(selectedDate);
                  const isToday = toDateString(d) === toDateString(startOfDay(new Date()));
                  return (
                    <TouchableOpacity
                      key={toDateString(d)}
                      style={[styles.datePill, isSelected && styles.datePillActive]}
                      onPress={() => setSelectedDate(d)}>
                      <Text style={[styles.datePillText, isSelected && styles.datePillTextActive]}>
                        {isToday ? 'Today' : DAYS_SHORT[d.getDay()]}, {MONTHS_SHORT[d.getMonth()]} {d.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Per-amenity cards */}
              {courts.map((court) => {
                const isExpanded = selectedCourtId === court.id;
                return (
                  <View key={court.id} style={styles.courtCard}>
                    <View style={styles.courtCardHeader}>
                      <View style={styles.courtInfo}>
                        <Text style={styles.courtName}>{court.name}</Text>
                        <Text style={styles.courtType}>{court.court_type}</Text>
                      </View>
                      <View style={styles.courtActions}>
                        <TouchableOpacity
                          style={[styles.slotsBtn, isExpanded && styles.slotsBtnActive]}
                          onPress={() => setSelectedCourtId(isExpanded ? '' : court.id)}
                          activeOpacity={0.8}>
                          <Text style={[styles.slotsBtnText, isExpanded && styles.slotsBtnTextActive]}>
                            {isExpanded ? 'Hide Slots' : 'Time Slots'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => confirmDelete(court)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 color={Colors.negative} size={16} strokeWidth={1.5} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Expanded slot grid */}
                    {isExpanded && (
                      <View style={styles.slotsContainer}>
                        <Text style={styles.slotsSectionLabel}>
                          TIME SLOTS — {formatDateLabel(selectedDate)}
                        </Text>
                        <View style={styles.slotGrid}>
                          {TIME_SLOTS.map((slot) => {
                            const status = getSlotStatus(slot);
                            const colors = slotColors[status];
                            const isMaintenance = status === 'maintenance';
                            const isBooked = status === 'booked';
                            return (
                              <View
                                key={slot}
                                style={[styles.slotCell, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                <Text style={[styles.slotTime, { color: colors.text }]}>{slot}</Text>
                                <Text style={[styles.slotStatusText, { color: colors.text }]}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </Text>
                                {!isBooked && (
                                  <TouchableOpacity
                                    style={[
                                      styles.slotToggleBtn,
                                      {
                                        backgroundColor: isMaintenance
                                          ? 'rgba(154,163,184,0.10)'
                                          : 'rgba(245,158,11,0.10)',
                                      },
                                    ]}
                                    onPress={() => toggleMaintenance(slot, isMaintenance)}>
                                    <Text style={[
                                      styles.slotToggleBtnText,
                                      { color: isMaintenance ? theme.textMuted : '#F59E0B' },
                                    ]}>
                                      {isMaintenance ? 'Make Available' : 'Set Maintenance'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {courts.length === 0 && !showAddForm && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No amenities yet</Text>
              <Text style={styles.emptySub}>Tap above to add your first amenity.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    scroll: { flex: 1 },
    content: { padding: Spacing.pagePx, gap: 12, paddingBottom: 100 },

    hero: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 8,
      paddingBottom: 20,
    },
    heroTag: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: Colors.accentCyan,
      letterSpacing: 2,
      marginBottom: 6,
    },
    heroTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.display,
      color: theme.textPrimary,
      letterSpacing: -0.8,
      lineHeight: 42,
    },
    heroSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      marginTop: 6,
      lineHeight: 22,
    },

    // Add dashed card
    addDashedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 18,
      borderRadius: 16,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.border,
    },
    addDashedLabel: {
      fontFamily: FontFamily.manropeBold,
      fontSize: FontSize.uiLabel,
      color: theme.textPrimary,
    },

    // Add form card
    addFormCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    addFormTitle: {
      fontFamily: FontFamily.manropeExtraBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      marginBottom: 16,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      color: theme.textMuted,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.input,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      backgroundColor: theme.pageBg,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    typePill: {
      width: '47%',
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    typePillActive: {
      borderColor: Colors.accentCyan,
      backgroundColor: 'rgba(45,224,255,0.08)',
    },
    typePillLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textMuted,
    },
    typePillLabelActive: {
      color: Colors.accentCyan,
    },
    formActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.pageBg,
      alignItems: 'center',
      minHeight: 44,
    },
    cancelBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    addBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: Radius.input,
      backgroundColor: Colors.navy,
      alignItems: 'center',
      minHeight: 44,
    },
    addBtnDisabled: { opacity: 0.4 },
    addBtnText: {
      fontFamily: FontFamily.manropeBold,
      fontSize: FontSize.uiLabel,
      color: Colors.white,
    },

    // Section
    sectionTitle: {
      fontFamily: FontFamily.manropeBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      marginTop: 4,
    },

    // Date selector
    dateSelectorLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      color: theme.textMuted,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 12,
    },
    dateScroll: { marginBottom: 4 },
    dateRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
    datePill: {
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
      minHeight: 44,
      justifyContent: 'center',
    },
    datePillActive: {
      backgroundColor: Colors.navy,
      borderColor: Colors.navy,
    },
    datePillText: {
      fontFamily: FontFamily.manropeBold,
      fontSize: 12,
      color: theme.textMuted,
    },
    datePillTextActive: { color: Colors.white },

    // Per-amenity card
    courtCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      ...theme.shadowCard,
    },
    courtCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    courtInfo: { flex: 1, minWidth: 0 },
    courtName: {
      fontFamily: FontFamily.manropeExtraBold,
      fontSize: 15,
      color: theme.textPrimary,
    },
    courtType: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.uiLabel,
      color: theme.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    courtActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slotsBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.input,
      backgroundColor: theme.pageBg,
      minHeight: 44,
      justifyContent: 'center',
    },
    slotsBtnActive: { backgroundColor: Colors.navy },
    slotsBtnText: {
      fontFamily: FontFamily.manropeBold,
      fontSize: 12,
      color: theme.textMuted,
    },
    slotsBtnTextActive: { color: Colors.white },
    deleteBtn: {
      width: 40,
      height: 40,
      borderRadius: Radius.input,
      backgroundColor: 'rgba(255,92,107,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Slots inside card
    slotsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    slotsSectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      color: theme.textMuted,
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    slotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    slotCell: {
      width: '47%',
      borderRadius: Radius.input,
      borderWidth: 1,
      padding: 10,
      gap: 4,
    },
    slotTime: {
      fontFamily: FontFamily.manropeBold,
      fontSize: 12,
    },
    slotStatusText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    slotToggleBtn: {
      borderRadius: Radius.input - 2,
      paddingVertical: 4,
      paddingHorizontal: 6,
      alignItems: 'center',
      minHeight: 28,
      justifyContent: 'center',
      marginTop: 2,
    },
    slotToggleBtnText: {
      fontFamily: FontFamily.manropeBold,
      fontSize: 10,
    },

    // Empty
    emptyWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 15,
      color: theme.textPrimary,
      marginBottom: 4,
    },
    emptySub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.uiLabel,
      color: theme.textSecondary,
    },
  }), [theme]);
}
