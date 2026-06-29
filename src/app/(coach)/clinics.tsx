import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Users,
  X,
} from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CreateClinicSheet, type ClinicFormData } from '@/components/coaching/CreateClinicSheet';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

interface ClinicRow {
  id: string;
  name: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  skillMin: number | null;
  skillMax: number | null;
  ageGroup: string;
  maxPlayers: number;
  price: number | null;
  description: string | null;
  status: 'draft' | 'published' | 'canceled';
  enrolledCount: number;
}

interface RosterPlayer {
  id: string;
  name: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  published: Colors.positive,
  draft:     Colors.volt,
  canceled:  Colors.negative,
};

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function fmtTime(s: string): string {
  const [h, m] = s.slice(0, 5).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function skillLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'All levels';
  if (min == null) return `UTR up to ${max}`;
  if (max == null) return `UTR ${min}+`;
  return `UTR ${min}–${max}`;
}

export default function CoachClinicsScreen() {
  const { theme } = useTheme();
  const [clinics, setClinics]             = useState<ClinicRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [coachId, setCoachId]             = useState('');
  const [createOpen, setCreateOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState<Partial<ClinicFormData> | undefined>(undefined);
  const [detailClinic, setDetailClinic]   = useState<ClinicRow | null>(null);
  const [roster, setRoster]               = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);

      const { data: rows, error } = await (supabase as any)
        .from('coach_clinics')
        .select(
          'id, name, date, start_time, duration_minutes, location, ' +
          'skill_min, skill_max, age_group, max_players, price, description, status',
        )
        .eq('coach_id', user.id)
        .order('date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;
      const items: any[] = rows ?? [];
      if (items.length === 0) { setClinics([]); return; }

      // Enrollment counts via SECURITY DEFINER RPC
      const ids = items.map((r: any) => r.id as string);
      const { data: counts } = await (supabase as any).rpc('clinic_enrollment_counts', { clinic_ids: ids });
      const countMap = new Map<string, number>(
        ((counts ?? []) as any[]).map((r: any) => [r.clinic_id as string, r.enrolled_count as number]),
      );

      setClinics(
        items.map((r: any): ClinicRow => ({
          id:              r.id,
          name:            r.name,
          date:            r.date,
          startTime:       r.start_time,
          durationMinutes: r.duration_minutes,
          location:        r.location,
          skillMin:        r.skill_min != null ? Number(r.skill_min) : null,
          skillMax:        r.skill_max != null ? Number(r.skill_max) : null,
          ageGroup:        r.age_group,
          maxPlayers:      r.max_players,
          price:           r.price != null ? Number(r.price) : null,
          description:     r.description ?? null,
          status:          r.status,
          enrolledCount:   countMap.get(r.id) ?? 0,
        })),
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to load clinics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openDetail(clinic: ClinicRow) {
    setDetailClinic(clinic);
    setRosterLoading(true);
    setRoster([]);
    try {
      // Coaches can see the full roster (RLS: coaches read clinic rosters)
      const { data: enrollments } = await (supabase as any)
        .from('clinic_enrollments')
        .select('player_id, status')
        .eq('clinic_id', clinic.id)
        .eq('status', 'enrolled');

      const playerIds = ((enrollments ?? []) as any[]).map((e: any) => e.player_id as string);
      if (playerIds.length === 0) { setRosterLoading(false); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', playerIds);

      const nameMap = new Map<string, string>(
        ((profiles ?? []) as any[]).map((p: any) => [p.id as string, (p.full_name as string | null) ?? 'Player']),
      );

      setRoster(
        ((enrollments ?? []) as any[]).map((e: any): RosterPlayer => ({
          id:     e.player_id,
          name:   nameMap.get(e.player_id) ?? 'Player',
          status: e.status,
        })),
      );
    } catch {
      // non-fatal — coach still sees the clinic detail
    } finally {
      setRosterLoading(false);
    }
  }

  async function cancelClinic(clinic: ClinicRow) {
    Alert.alert(
      'Cancel clinic?',
      `This will cancel "${clinic.name}" and notify enrolled players.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Clinic',
          style: 'destructive',
          onPress: async () => {
            const { error } = await (supabase as any)
              .from('coach_clinics')
              .update({ status: 'canceled' })
              .eq('id', clinic.id)
              .eq('coach_id', coachId);
            if (error) {
              Alert.alert('Unable to cancel', error.message);
              return;
            }
            setDetailClinic(null);
            void load();
          },
        },
      ],
    );
  }

  function startEdit(clinic: ClinicRow) {
    const formData: Partial<ClinicFormData> = {
      id:              clinic.id,
      name:            clinic.name,
      date:            clinic.date,
      startTime:       clinic.startTime,
      durationMinutes: clinic.durationMinutes,
      location:        clinic.location,
      skillMin:        clinic.skillMin != null ? String(clinic.skillMin) : '',
      skillMax:        clinic.skillMax != null ? String(clinic.skillMax) : '',
      ageGroup:        clinic.ageGroup as ClinicFormData['ageGroup'],
      maxPlayers:      String(clinic.maxPlayers),
      description:     clinic.description ?? '',
      price:           clinic.price != null ? String(clinic.price) : '',
      status:          clinic.status as ClinicFormData['status'],
    };
    setEditTarget(formData);
    setDetailClinic(null);
    setCreateOpen(true);
  }

  return (
    <View style={[s.root, { backgroundColor: theme.pageBg }]}>
      <Header
        variant="inner"
        title="My Clinics"
        onBack={() => router.back()}
      />

      {/* New Clinic button */}
      <View style={s.toolbar}>
        <TouchableOpacity
          style={s.newBtn}
          onPress={() => { setEditTarget(undefined); setCreateOpen(true); }}
          activeOpacity={0.8}>
          <Plus size={18} color={Colors.white} />
          <Text style={s.newBtnText}>New Clinic</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
      ) : clinics.length === 0 ? (
        <View style={s.empty}>
          <CalendarDays size={44} color={theme.textMuted} strokeWidth={1.2} />
          <Text style={[s.emptyTitle, { color: theme.textPrimary }]}>No clinics yet</Text>
          <Text style={[s.emptyBody, { color: theme.textMuted }]}>
            Create your first clinic to start enrolling players.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {clinics.map(clinic => (
            <TouchableOpacity
              key={clinic.id}
              style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => openDetail(clinic)}
              activeOpacity={0.8}>
              <View style={s.cardTop}>
                <Text style={[s.clinicName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {clinic.name}
                </Text>
                <View style={[s.statusPill, { backgroundColor: `${STATUS_COLORS[clinic.status]}1A` }]}>
                  <Text style={[s.statusText, { color: STATUS_COLORS[clinic.status] }]}>
                    {clinic.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={s.cardMeta}>
                <View style={s.metaRow}>
                  <CalendarDays size={13} color={theme.textMuted} strokeWidth={1.5} />
                  <Text style={[s.metaText, { color: theme.textSecondary }]}>
                    {fmtDate(clinic.date)} · {fmtTime(clinic.startTime)}
                  </Text>
                </View>
                <View style={s.metaRow}>
                  <MapPin size={13} color={theme.textMuted} strokeWidth={1.5} />
                  <Text style={[s.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {clinic.location}
                  </Text>
                </View>
                <View style={s.metaRow}>
                  <Users size={13} color={theme.textMuted} strokeWidth={1.5} />
                  <Text style={[s.metaText, { color: theme.textSecondary }]}>
                    {clinic.enrolledCount} / {clinic.maxPlayers} enrolled
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* Clinic Detail Modal */}
      <Modal
        visible={detailClinic !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailClinic(null)}>
        <View style={[s.detailBackdrop, { backgroundColor: theme.backdrop }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDetailClinic(null)} activeOpacity={1} />
          {detailClinic && (
            <View style={[s.detailSheet, { backgroundColor: theme.sheetBg }]}>
              <View style={s.handle} />

              {/* Header */}
              <View style={s.detailHeader}>
                <Text style={[s.detailTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {detailClinic.name}
                </Text>
                <TouchableOpacity onPress={() => setDetailClinic(null)} style={s.closeBtn}>
                  <X size={22} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Info */}
                <View style={s.detailMeta}>
                  <View style={s.metaRow}>
                    <CalendarDays size={15} color={Colors.blue} strokeWidth={1.5} />
                    <Text style={[s.detailMetaText, { color: theme.textSecondary }]}>
                      {fmtDate(detailClinic.date)} · {fmtTime(detailClinic.startTime)} · {detailClinic.durationMinutes} min
                    </Text>
                  </View>
                  <View style={s.metaRow}>
                    <MapPin size={15} color={Colors.blue} strokeWidth={1.5} />
                    <Text style={[s.detailMetaText, { color: theme.textSecondary }]}>
                      {detailClinic.location}
                    </Text>
                  </View>
                  <View style={s.metaRow}>
                    <Clock3 size={15} color={Colors.blue} strokeWidth={1.5} />
                    <Text style={[s.detailMetaText, { color: theme.textSecondary }]}>
                      {skillLabel(detailClinic.skillMin, detailClinic.skillMax)}
                    </Text>
                  </View>
                  <View style={s.metaRow}>
                    <Users size={15} color={Colors.blue} strokeWidth={1.5} />
                    <Text style={[s.detailMetaText, { color: theme.textSecondary }]}>
                      {detailClinic.enrolledCount} / {detailClinic.maxPlayers} enrolled
                    </Text>
                  </View>
                </View>

                {/* Roster */}
                <Text style={[s.rosterTitle, { color: theme.textMuted }]}>ENROLLED PLAYERS</Text>
                {rosterLoading ? (
                  <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 16 }} />
                ) : roster.length === 0 ? (
                  <Text style={[s.rosterEmpty, { color: theme.textMuted }]}>No players enrolled yet.</Text>
                ) : (
                  roster.map((player, i) => (
                    <View
                      key={player.id}
                      style={[
                        s.rosterRow,
                        i < roster.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                      ]}>
                      <View style={[s.rosterAvatar, { backgroundColor: theme.surface2 }]}>
                        <Text style={[s.rosterAvatarText, { color: theme.textPrimary }]}>
                          {player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                      </View>
                      <Text style={[s.rosterName, { color: theme.textPrimary }]}>{player.name}</Text>
                    </View>
                  ))
                )}

                {/* Actions */}
                <View style={s.detailActions}>
                  {detailClinic.status !== 'canceled' && (
                    <>
                      <TouchableOpacity
                        style={[s.actionBtn, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
                        onPress={() => startEdit(detailClinic)}
                        activeOpacity={0.8}>
                        <Text style={[s.actionBtnText, { color: theme.textPrimary }]}>Edit Clinic</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.cancelBtn}
                        onPress={() => cancelClinic(detailClinic)}
                        activeOpacity={0.8}>
                        <Text style={s.cancelBtnText}>Cancel Clinic</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                <View style={{ height: 32 }} />
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      <CreateClinicSheet
        visible={createOpen}
        initial={editTarget}
        onClose={() => { setCreateOpen(false); setEditTarget(undefined); }}
        onSaved={() => {
          Alert.alert(
            editTarget?.id ? 'Clinic Updated' : 'Clinic Created',
            editTarget?.id ? 'Your changes have been saved.' : 'Your clinic has been created.',
          );
          void load();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: 12,
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.blue, borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  newBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label, color: Colors.white,
  },
  list: { paddingHorizontal: Spacing.pagePx, gap: 12, paddingBottom: 80 },
  card: {
    borderWidth: 1, borderRadius: Radius.card,
    padding: Spacing.cardPadding, gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clinicName: {
    flex: 1, fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.cardTitle, letterSpacing: -0.3,
  },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.pill, flexShrink: 0,
  },
  statusText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 10, letterSpacing: 0.5,
  },
  cardMeta: { gap: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label, flex: 1,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.sectionTitle,
  },
  emptyBody: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body, textAlign: 'center', lineHeight: 24,
  },

  // Detail modal
  detailBackdrop: { flex: 1, justifyContent: 'flex-end' },
  detailSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.pagePx,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handle: {
    width: 42, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center', marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 18,
  },
  detailTitle: { flex: 1, fontFamily: FontFamily.spaceGroteskBold, fontSize: 22 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  detailMeta: { gap: 9, marginBottom: 20 },
  detailMetaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, flex: 1 },
  rosterTitle: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow, letterSpacing: 0.18, marginBottom: 12,
  },
  rosterEmpty: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, marginBottom: 16 },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 56,
  },
  rosterAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  rosterAvatarText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  rosterName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  detailActions: { gap: 10, marginTop: 24 },
  actionBtn: {
    height: 50, borderWidth: 1, borderRadius: Radius.button,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  cancelBtn: {
    height: 50, backgroundColor: 'rgba(255,92,107,0.12)',
    borderRadius: Radius.button, borderWidth: 1,
    borderColor: 'rgba(255,92,107,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body, color: Colors.negative,
  },
});
