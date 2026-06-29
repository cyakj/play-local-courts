import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarDays,
  Clock3,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { LessonWeather } from '@/components/weather/LessonWeather';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { isWithinWeatherWindow } from '@/hooks/useWeather';
import { supabase } from '@/lib/supabase';

interface ClinicDetail {
  id: string;
  coachId: string;
  coachName: string;
  coachProfileId: string | null;
  name: string;
  description: string | null;
  date: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  skillMin: number | null;
  skillMax: number | null;
  ageGroup: string;
  maxPlayers: number;
  price: number | null;
  enrolledCount: number;
  isEnrolled: boolean;
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function fmtTime(s: string): string {
  const [h, m] = s.slice(0, 5).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function skillLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'All skill levels';
  if (min != null && max != null) return `NTRP ${min.toFixed(1)}–${max.toFixed(1)}`;
  if (min != null) return `NTRP ${min.toFixed(1)}+`;
  return `NTRP up to ${(max ?? 0).toFixed(1)}`;
}

const AGE_LABELS: Record<string, string> = {
  junior: 'Juniors',
  adult:  'Adults',
  all:    'All ages',
};

export default function ClinicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [clinic, setClinic]     = useState<ClinicDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [joining, setJoining]   = useState(false);
  const [userId, setUserId]     = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? '';
      setUserId(uid);

      const { data: row, error } = await (supabase as any)
        .from('coach_clinics')
        .select(
          'id, coach_id, name, description, date, start_time, duration_minutes, ' +
          'location, skill_min, skill_max, age_group, max_players, price',
        )
        .eq('id', id)
        .single();

      if (error || !row) {
        Alert.alert('Not found', 'This clinic could not be loaded.');
        router.back();
        return;
      }

      // Coach name — select only non-identifying fields
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', row.coach_id)
        .single();

      // Coach profile page id (coaches.id, not user_id)
      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', row.coach_id)
        .maybeSingle();

      // Enrollment count via SECURITY DEFINER RPC — no player identities returned
      const { data: counts } = await (supabase as any).rpc('clinic_enrollment_counts', {
        clinic_ids: [row.id],
      });
      const enrolled = (counts ?? []).find((r: any) => r.clinic_id === row.id)?.enrolled_count ?? 0;

      // Check if current user is enrolled (reads only own row due to RLS)
      let isEnrolled = false;
      if (uid) {
        const { data: ownRow } = await (supabase as any)
          .from('clinic_enrollments')
          .select('id, status')
          .eq('clinic_id', row.id)
          .eq('player_id', uid)
          .maybeSingle();
        isEnrolled = ownRow?.status === 'enrolled';
      }

      setClinic({
        id:              row.id,
        coachId:         row.coach_id,
        coachName:       profile?.full_name ?? 'Coach',
        coachProfileId:  coachRow?.id ?? null,
        name:            row.name,
        description:     row.description ?? null,
        date:            row.date,
        startTime:       row.start_time,
        durationMinutes: row.duration_minutes,
        location:        row.location,
        skillMin:        row.skill_min != null ? Number(row.skill_min) : null,
        skillMax:        row.skill_max != null ? Number(row.skill_max) : null,
        ageGroup:        row.age_group,
        maxPlayers:      row.max_players,
        price:           row.price != null ? Number(row.price) : null,
        enrolledCount:   enrolled,
        isEnrolled,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function joinClinic() {
    if (!clinic || !userId) return;
    setJoining(true);
    try {
      const { error } = await (supabase as any)
        .from('clinic_enrollments')
        .insert({ clinic_id: clinic.id, player_id: userId, status: 'enrolled' });
      if (error) {
        if (error.code === '23505') {
          // Already enrolled — re-activate
          await (supabase as any)
            .from('clinic_enrollments')
            .update({ status: 'enrolled' })
            .eq('clinic_id', clinic.id)
            .eq('player_id', userId);
        } else {
          throw error;
        }
      }
      setClinic(prev => prev
        ? { ...prev, isEnrolled: true, enrolledCount: prev.enrolledCount + 1 }
        : prev,
      );
    } catch (e) {
      Alert.alert('Unable to join', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: theme.pageBg }]}>
        <Header variant="inner" title="Clinic Details" onBack={() => router.back()} />
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!clinic) return null;

  const spotsLeft = Math.max(clinic.maxPlayers - clinic.enrolledCount, 0);
  const isFull    = spotsLeft === 0;

  return (
    <View style={[s.root, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="Clinic Details" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[s.clinicName, { color: theme.textPrimary }]}>{clinic.name}</Text>

          <TouchableOpacity
            onPress={() => clinic.coachProfileId && router.push(`/coach-profile/${clinic.coachProfileId}` as any)}
            activeOpacity={clinic.coachProfileId ? 0.75 : 1}
            style={s.coachRow}>
            <View style={[s.coachAvatar, { backgroundColor: theme.surface2 }]}>
              <Text style={[s.coachAvatarText, { color: theme.textSecondary }]}>
                {clinic.coachName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.coachName, { color: theme.textPrimary }]}>{clinic.coachName}</Text>
              {clinic.coachProfileId && (
                <Text style={[s.coachLink, { color: Colors.cyan }]}>View profile →</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Details */}
        <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <DetailRow icon={<CalendarDays size={18} color={Colors.blue} strokeWidth={1.5} />}>
            <Text style={[s.detailText, { color: theme.textSecondary }]}>{fmtDate(clinic.date)}</Text>
          </DetailRow>
          <DetailRow icon={<Clock3 size={18} color={Colors.blue} strokeWidth={1.5} />}>
            <Text style={[s.detailText, { color: theme.textSecondary }]}>
              {fmtTime(clinic.startTime)} · {clinic.durationMinutes} min
            </Text>
          </DetailRow>
          <DetailRow icon={<MapPin size={18} color={Colors.blue} strokeWidth={1.5} />}>
            <Text style={[s.detailText, { color: theme.textSecondary }]}>{clinic.location}</Text>
          </DetailRow>
          <DetailRow icon={<Users size={18} color={Colors.blue} strokeWidth={1.5} />}>
            <Text style={[s.detailText, { color: theme.textSecondary }]}>
              {skillLabel(clinic.skillMin, clinic.skillMax)} · {AGE_LABELS[clinic.ageGroup] ?? clinic.ageGroup}
            </Text>
          </DetailRow>

          {/* Spots — never show individual enrolled players */}
          <View style={[s.spotsRow, { borderTopColor: theme.border }]}>
            <View style={[
              s.spotsBadge,
              { backgroundColor: isFull ? 'rgba(255,92,107,0.12)' : 'rgba(47,217,139,0.12)' },
            ]}>
              <ShieldCheck size={15} color={isFull ? Colors.negative : Colors.positive} />
              <Text style={[s.spotsText, { color: isFull ? Colors.negative : Colors.positive }]}>
                {isFull
                  ? `Full · ${clinic.maxPlayers} / ${clinic.maxPlayers}`
                  : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left · ${clinic.enrolledCount} / ${clinic.maxPlayers} filled`}
              </Text>
            </View>
          </View>

          {/* Weather */}
          <View style={[s.spotsRow, { borderTopColor: theme.border }]}>
            {isWithinWeatherWindow(clinic.date) ? (
              <LessonWeather date={clinic.date} time={clinic.startTime} location={clinic.location} />
            ) : (
              <Text style={[s.weatherFuture, { color: theme.textMuted }]}>
                Weather available closer to date
              </Text>
            )}
          </View>
        </View>

        {/* Description */}
        {clinic.description ? (
          <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>About this clinic</Text>
            <Text style={[s.description, { color: theme.textSecondary }]}>{clinic.description}</Text>
          </View>
        ) : null}

        {/* Price */}
        {clinic.price != null && (
          <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>Price</Text>
            <Text style={[s.priceText, { color: Colors.positive }]}>
              ${clinic.price.toFixed(2)}
            </Text>
            <Text style={[s.priceNote, { color: theme.textMuted }]}>
              Payment handled outside the app for now.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[s.footer, { backgroundColor: theme.pageBg, borderTopColor: theme.border }]}>
        {clinic.isEnrolled ? (
          <View style={s.enrolledBadge}>
            <ShieldCheck size={18} color={Colors.positive} />
            <Text style={s.enrolledText}>You are enrolled in this clinic</Text>
          </View>
        ) : isFull ? (
          <View style={s.fullBanner}>
            <Text style={[s.fullText, { color: theme.textMuted }]}>This clinic is full</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.joinBtn, joining && s.joinBtnDisabled]}
            onPress={joinClinic}
            disabled={joining}
            activeOpacity={0.8}>
            <Text style={s.joinBtnText}>{joining ? 'Joining…' : 'Join Clinic'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.detailRow}>
      {icon}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 40, gap: 16 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.cardPadding, gap: 14 },
  clinicName: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 26, letterSpacing: -0.4,
  },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  coachAvatarText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14 },
  coachName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  coachLink: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 22 },
  spotsRow: {
    paddingTop: 14, borderTopWidth: 1,
  },
  spotsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  spotsText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  weatherFuture: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  sectionTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.cardTitle, marginBottom: 4,
  },
  description: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24 },
  priceText: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 28 },
  priceNote: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
  footer: {
    padding: Spacing.pagePx,
    borderTopWidth: 1,
  },
  joinBtn: {
    height: 52, backgroundColor: Colors.blue,
    borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center',
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body, color: Colors.white,
  },
  enrolledBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 52,
    backgroundColor: 'rgba(47,217,139,0.12)',
    borderRadius: Radius.button, borderWidth: 1,
    borderColor: 'rgba(47,217,139,0.25)',
  },
  enrolledText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body, color: Colors.positive,
  },
  fullBanner: {
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  fullText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});
