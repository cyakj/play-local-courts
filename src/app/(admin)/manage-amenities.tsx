import { useEffect, useMemo, useState } from 'react';
import {
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
import { router, useLocalSearchParams } from 'expo-router';
import {
  Plus, Trash2, Dumbbell, Waves, Building2, Flame, X, Settings, TrendingUp,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { platformAlert } from '@/lib/platformAlert';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
  MaxWidth,
} from '@/constants/design';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { TimePicker } from '@/components/ui/TimePicker';
import { Stepper } from '@/components/ui/Stepper';
import { RulesSummary } from '@/components/ui/RulesSummary';
import { AddAmenityWizard } from '@/components/admin/AddAmenityWizard';
import { BlockoutSheet } from '@/components/admin/BlockoutSheet';
import { useTheme } from '@/context/ThemeContext';
import { formatDateFull, formatTime12h } from '@/lib/format';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];
type AmenityRules = Database['public']['Tables']['amenity_rules']['Row'];
type Maintenance = Database['public']['Tables']['court_maintenance']['Row'];

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

interface UpcomingBooking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  residentName: string;
}

function getTypeIcon(courtType: string) {
  switch (courtType) {
    case 'tennis':
    case 'pickleball':
    case 'gym':
      return <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'pool':
    case 'jacuzzi':
      return <Waves color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'clubhouse':
      return <Building2 color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'barbecue':
      return <Flame color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    default:
      return <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ManageAmenitiesScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { hoaId } = useLocalSearchParams<{ hoaId: string }>();

  const [courts, setCourts] = useState<Court[]>([]);
  const [upcomingCounts, setUpcomingCounts] = useState<Record<string, number>>({});
  const [nextBlockouts, setNextBlockouts] = useState<Record<string, Maintenance>>({});
  const [loading, setLoading] = useState(true);

  // Add Amenity wizard
  const [wizardVisible, setWizardVisible] = useState(false);

  // Detail modal
  const [detailCourt, setDetailCourt] = useState<Court | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CourtTypeValue>('tennis');
  const [editCapacity, setEditCapacity] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [rules, setRules] = useState<Partial<AmenityRules>>({});
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [utilization30d, setUtilization30d] = useState(0);
  const [detailSaving, setDetailSaving] = useState(false);

  // Blockout sheet
  const [blockoutVisible, setBlockoutVisible] = useState(false);

  async function loadCourts() {
    setLoading(true);
    let query = supabase.from('courts').select('*').order('name', { ascending: true });
    if (hoaId) query = query.eq('hoa_id', hoaId);
    const { data } = await query;
    const list = data ?? [];
    setCourts(list);

    if (list.length > 0) {
      const ids = list.map((c) => c.id);
      const [bookingsRes, maintRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('court_id')
          .in('court_id', ids)
          .gte('date', todayISO())
          .neq('status', 'cancelled'),
        supabase
          .from('court_maintenance')
          .select('*')
          .in('court_id', ids)
          .gte('date', todayISO())
          .order('date', { ascending: true }),
      ]);
      const counts: Record<string, number> = {};
      for (const b of bookingsRes.data ?? []) {
        counts[b.court_id] = (counts[b.court_id] ?? 0) + 1;
      }
      setUpcomingCounts(counts);

      const nextByCourt: Record<string, Maintenance> = {};
      for (const m of maintRes.data ?? []) {
        if (!nextByCourt[m.court_id]) nextByCourt[m.court_id] = m;
      }
      setNextBlockouts(nextByCourt);
    } else {
      setUpcomingCounts({});
      setNextBlockouts({});
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCourts();
  }, []);

  function confirmDelete(court: Court) {
    const upcoming = upcomingCounts[court.id] ?? 0;
    if (upcoming > 0) {
      platformAlert(
        'Cannot Delete Amenity',
        `"${court.name}" has ${upcoming} upcoming reservation${upcoming === 1 ? '' : 's'}. Cancel those reservations first, or use "Disable" instead of Delete to stop new bookings without cancelling existing ones.`,
      );
      return;
    }
    platformAlert(
      'Delete Amenity',
      `Are you sure you want to delete "${court.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCourt(court.id),
        },
      ],
    );
  }

  async function deleteCourt(id: string) {
    const { error } = await supabase.from('courts').delete().eq('id', id);
    if (error) {
      platformAlert('Delete Failed', error.message);
      return;
    }
    loadCourts();
  }

  async function applyActiveChange(court: Court, nextActive: boolean) {
    setCourts((prev) => prev.map((c) => (c.id === court.id ? { ...c, is_active: nextActive } : c)));
    const { error } = await supabase.from('courts').update({ is_active: nextActive }).eq('id', court.id);
    if (error) {
      setCourts((prev) => prev.map((c) => (c.id === court.id ? { ...c, is_active: court.is_active } : c)));
      platformAlert('Update Failed', error.message);
    }
  }

  function handleToggleActive(court: Court) {
    const turningOff = court.is_active;
    const upcoming = upcomingCounts[court.id] ?? 0;
    if (turningOff && upcoming > 0) {
      platformAlert(
        'Disable Amenity?',
        `"${court.name}" has ${upcoming} upcoming reservation${upcoming === 1 ? '' : 's'}. Disabling stops new bookings but will NOT cancel or affect these existing reservations.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable Anyway', style: 'destructive', onPress: () => applyActiveChange(court, false) },
        ],
      );
      return;
    }
    applyActiveChange(court, !court.is_active);
  }

  async function openDetail(court: Court) {
    setDetailCourt(court);
    setDetailLoading(true);
    setEditName(court.name);
    setEditType(court.court_type as CourtTypeValue);
    setEditCapacity(court.capacity != null ? String(court.capacity) : '');
    setEditDescription(court.description ?? '');
    setEditActive(court.is_active);

    const [rulesRes, maintRes, bookingsRes, utilRes] = await Promise.all([
      supabase.from('amenity_rules').select('*').eq('amenity_id', court.id).maybeSingle(),
      supabase
        .from('court_maintenance')
        .select('*')
        .eq('court_id', court.id)
        .gte('date', todayISO())
        .order('date', { ascending: true }),
      supabase
        .from('bookings')
        .select('id, date, start_time, end_time, status, user_id')
        .eq('court_id', court.id)
        .gte('date', todayISO())
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .limit(10),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('court_id', court.id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .neq('status', 'cancelled'),
    ]);

    setRules(rulesRes.data ?? {});
    setMaintenance(maintRes.data ?? []);
    setUtilization30d(utilRes.count ?? 0);

    const bookingRows = (bookingsRes.data ?? []) as any[];
    const userIds = [...new Set(bookingRows.map((b) => b.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Resident']));
    setUpcomingBookings(bookingRows.map((b) => ({
      id: b.id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      residentName: nameMap.get(b.user_id) ?? 'Resident',
    })));

    setDetailLoading(false);
  }

  function closeDetail() {
    setDetailCourt(null);
  }

  async function saveDetail() {
    if (!detailCourt) return;
    setDetailSaving(true);

    const { error: courtError } = await supabase
      .from('courts')
      .update({
        name: editName.trim() || detailCourt.name,
        court_type: editType,
        capacity: editCapacity.trim() ? Number(editCapacity.trim()) : null,
        description: editDescription.trim() || null,
        is_active: editActive,
      })
      .eq('id', detailCourt.id);

    if (courtError) {
      setDetailSaving(false);
      platformAlert('Save Failed', courtError.message);
      return;
    }

    const rulesPayload = {
      hoa_id: detailCourt.hoa_id,
      amenity_id: detailCourt.id,
      booking_start_time: rules.booking_start_time || null,
      booking_end_time: rules.booking_end_time || null,
      max_duration_minutes: rules.max_duration_minutes ?? null,
      advance_booking_days: rules.advance_booking_days ?? null,
      min_cancellation_hours: rules.min_cancellation_hours ?? null,
      max_reservations_per_day: rules.max_reservations_per_day ?? null,
      requires_admin_approval: rules.requires_admin_approval ?? false,
    };

    const rulesRes = rules.id
      ? await supabase.from('amenity_rules').update(rulesPayload).eq('id', rules.id)
      : await supabase.from('amenity_rules').insert(rulesPayload);

    setDetailSaving(false);

    if (rulesRes.error) {
      platformAlert('Booking Rules Not Saved', `${rulesRes.error.message} (amenity details were saved)`);
      return;
    }

    setDetailCourt(null);
    loadCourts();
  }

  async function handleBlockoutSaved() {
    if (!detailCourt) return;
    // A saved blockout can also cancel conflicting bookings, so refresh the
    // full detail set (maintenance list + upcoming reservations) plus the
    // list-level upcoming/next-blockout counts shown on the card underneath.
    await openDetail(detailCourt);
    loadCourts();
  }

  function confirmDeleteBlockout(id: string) {
    platformAlert(
      'Remove Blockout',
      'Residents will be able to book this amenity during this window again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteBlockout(id) },
      ],
    );
  }

  async function deleteBlockout(id: string) {
    const { error } = await supabase.from('court_maintenance').delete().eq('id', id);
    if (error) {
      platformAlert('Delete Failed', error.message);
      return;
    }
    setMaintenance((prev) => prev.filter((m) => m.id !== id));
  }

  const plusButton = (
    <TouchableOpacity
      onPress={() => setWizardVisible(true)}
      style={styles.plusBtn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Plus color="#FFFFFF" size={22} strokeWidth={1.5} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title="Manage Amenities"
        onBack={() => router.back()}
        rightIcon={plusButton}
      />

      <View style={styles.hero}>
        <Text style={styles.heroTag}>ADMIN</Text>
        <Text style={styles.heroTitle}>Manage Amenities</Text>
        <Text style={styles.heroSub}>
          Add amenities and configure hours, booking rules, blockouts, and capacity.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {!loading && courts.length === 0 && (
            <EmptyState
              icon={<Building2 color={theme.textMuted} size={48} strokeWidth={1.5} />}
              title="No amenities yet"
              subtitle="Add your first amenity using the + button above."
            />
          )}

          {courts.map((court) => {
            const upcoming = upcomingCounts[court.id] ?? 0;
            const nextBlockout = nextBlockouts[court.id];
            return (
              <Card key={court.id} style={styles.courtCard}>
                <TouchableOpacity
                  style={styles.courtRow}
                  onPress={() => openDetail(court)}
                  activeOpacity={0.75}>
                  <View style={styles.typeIconWrap}>{getTypeIcon(court.court_type)}</View>
                  <View style={styles.courtInfo}>
                    <Text style={styles.courtName}>{court.name}</Text>
                    <Text style={styles.courtType}>
                      {court.court_type.toUpperCase()}
                      {court.capacity != null ? ` · CAP ${court.capacity}` : ''}
                      {upcoming > 0 ? ` · ${upcoming} UPCOMING` : ''}
                    </Text>
                    {nextBlockout && (
                      <Text style={styles.nextBlockoutText}>
                        Next blockout: {formatDateFull(nextBlockout.date)}
                      </Text>
                    )}
                  </View>
                  <Settings color={theme.textMuted} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
                <View style={styles.courtFooter}>
                  <View style={styles.activeRow}>
                    <Text style={[styles.activeLabel, !court.is_active && styles.activeLabelOff]}>
                      {court.is_active ? 'Available for booking' : 'Temporarily closed'}
                    </Text>
                    <Switch
                      value={court.is_active}
                      onValueChange={() => handleToggleActive(court)}
                      trackColor={{ false: theme.border, true: Colors.accentCyan }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDelete(court)}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 color={Colors.negative} size={18} strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <AddAmenityWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        hoaId={hoaId ?? ''}
        theme={theme}
        onCreated={loadCourts}
      />

      {/* Detail / Settings Modal */}
      <Modal
        visible={!!detailCourt}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}>
        {detailCourt && (
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{detailCourt.name}</Text>
              <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={theme.textMuted} size={22} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled">

              {/* Utilization */}
              <View style={styles.utilBanner}>
                <TrendingUp color={Colors.accentCyan} size={18} strokeWidth={1.5} />
                <Text style={styles.utilBannerText}>
                  {utilization30d} booking{utilization30d === 1 ? '' : 's'} in the last 30 days
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Basic Info</Text>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TYPE</Text>
              <View style={styles.typeGrid}>
                {COURT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, editType === t && styles.typePillActive]}
                    onPress={() => setEditType(t)}>
                    <Text style={[styles.typePillLabel, editType === t && styles.typePillLabelActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CAPACITY (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                value={editCapacity}
                onChangeText={setEditCapacity}
                placeholder="e.g. 4"
                keyboardType="number-pad"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Notes visible to admins about this amenity"
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={[styles.activeRow, { marginTop: 16 }]}>
                <Text style={styles.activeLabel}>Available for booking</Text>
                <Switch
                  value={editActive}
                  onValueChange={setEditActive}
                  trackColor={{ false: theme.border, true: Colors.accentCyan }}
                />
              </View>

              <View style={styles.dividerLine} />
              <Text style={styles.sectionTitle}>Booking Rules</Text>
              <View style={{ marginBottom: 16 }}>
                <RulesSummary rules={rules} theme={theme} />
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <TimePicker
                    label="OPEN TIME"
                    value={rules.booking_start_time ?? null}
                    onChange={(v) => setRules((r) => ({ ...r, booking_start_time: v }))}
                    theme={theme}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePicker
                    label="CLOSE TIME"
                    value={rules.booking_end_time ?? null}
                    onChange={(v) => setRules((r) => ({ ...r, booking_end_time: v }))}
                    theme={theme}
                  />
                </View>
              </View>

              <View style={{ marginTop: 20, gap: 20 }}>
                <Stepper
                  label="BOOKING DURATION"
                  value={rules.max_duration_minutes ?? 60}
                  onChange={(v) => setRules((r) => ({ ...r, max_duration_minutes: v }))}
                  min={15}
                  max={240}
                  step={15}
                  unit="min"
                  theme={theme}
                />
                <Stepper
                  label="ADVANCE BOOKING WINDOW"
                  value={rules.advance_booking_days ?? 14}
                  onChange={(v) => setRules((r) => ({ ...r, advance_booking_days: v }))}
                  min={1}
                  max={90}
                  step={1}
                  unit="days"
                  theme={theme}
                />
                <Stepper
                  label="CANCELLATION WINDOW"
                  value={rules.min_cancellation_hours ?? 2}
                  onChange={(v) => setRules((r) => ({ ...r, min_cancellation_hours: v }))}
                  min={0}
                  max={72}
                  step={1}
                  unit="hrs"
                  theme={theme}
                />
                <Stepper
                  label="MAX RESERVATIONS / DAY"
                  value={rules.max_reservations_per_day ?? 1}
                  onChange={(v) => setRules((r) => ({ ...r, max_reservations_per_day: v }))}
                  min={1}
                  max={10}
                  step={1}
                  theme={theme}
                />
              </View>

              <View style={[styles.activeRow, { marginTop: 20 }]}>
                <Text style={styles.activeLabel}>Requires admin approval</Text>
                <Switch
                  value={rules.requires_admin_approval ?? false}
                  onValueChange={(v) => setRules((r) => ({ ...r, requires_admin_approval: v }))}
                  trackColor={{ false: theme.border, true: Colors.accentCyan }}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  variant="primary"
                  label="Save Changes"
                  onPress={saveDetail}
                  loading={detailSaving}
                  fullWidth
                />
              </View>

              <View style={styles.dividerLine} />
              <Text style={styles.sectionTitle}>Maintenance / Blockouts</Text>

              {maintenance.length === 0 ? (
                <Text style={styles.emptyInlineText}>No upcoming blockouts.</Text>
              ) : maintenance.map((m) => (
                <View key={m.id} style={styles.blockoutRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockoutDate}>
                      {formatDateFull(m.date)}{m.end_date ? ` → ${formatDateFull(m.end_date)}` : ''} · {formatTime12h(m.start_time)}–{formatTime12h(m.end_time)}
                    </Text>
                    {m.description ? <Text style={styles.blockoutDesc}>{m.description}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDeleteBlockout(m.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 color={Colors.negative} size={16} strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ marginTop: 12 }}>
                <Button variant="ghost" label="Add Blockout" onPress={() => setBlockoutVisible(true)} fullWidth />
              </View>

              <View style={styles.dividerLine} />
              <Text style={styles.sectionTitle}>Upcoming Reservations</Text>
              {detailLoading ? (
                <Text style={styles.emptyInlineText}>Loading…</Text>
              ) : upcomingBookings.length === 0 ? (
                <Text style={styles.emptyInlineText}>No upcoming reservations.</Text>
              ) : upcomingBookings.map((b) => (
                <View key={b.id} style={styles.reservationRow}>
                  <Text style={styles.reservationDate}>
                    {formatDateFull(b.date)} · {formatTime12h(b.start_time)}–{formatTime12h(b.end_time)}
                  </Text>
                  <Text style={styles.reservationName}>{b.residentName}</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {detailCourt && (
        <BlockoutSheet
          visible={blockoutVisible}
          onClose={() => setBlockoutVisible(false)}
          courtId={detailCourt.id}
          courtName={detailCourt.name}
          hoaId={detailCourt.hoa_id}
          rules={rules}
          theme={theme}
          onSaved={() => {
            setBlockoutVisible(false);
            handleBlockoutSaved();
          }}
        />
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    scroll: { flex: 1 },
    content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },

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

    plusBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    courtCard: { padding: 16 },
    courtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    typeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(45,224,255,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    courtInfo: { flex: 1 },
    courtName: {
      fontFamily: FontFamily.manropeBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    courtType: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1,
      marginTop: 2,
    },
    nextBlockoutText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.metadata,
      color: Colors.negative,
      marginTop: 4,
    },
    courtFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    activeLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textPrimary,
    },
    activeLabelOff: { color: theme.textMuted },
    deleteBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Modal
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
    fieldRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
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
    typePillLabelActive: {
      color: Colors.white,
    },
    modalActions: {
      marginTop: 24,
    },
    dividerLine: { height: 1, backgroundColor: theme.border, marginVertical: 24 },

    utilBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderRadius: Radius.card,
      padding: 12,
      marginBottom: 20,
    },
    utilBannerText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textPrimary,
    },

    emptyInlineText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      marginBottom: 12,
    },
    blockoutRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    blockoutDate: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textPrimary,
    },
    blockoutDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      marginTop: 2,
    },
    reservationRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    reservationDate: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.uiLabel,
      color: theme.textPrimary,
    },
    reservationName: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
    },
  }), [theme]);
}
