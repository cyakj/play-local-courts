import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  HelpCircle,
  LogOut,
  MessageCircle,
  PenLine,
  Settings,
  Swords,
  UserCircle,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const LESSON_TYPE_SHORT: Record<string, string> = {
  private_lesson:      'Private',
  semi_private_lesson: 'Semi-Private',
  group_clinic:        'Group Clinic',
  practice_session:    'Practice',
};

interface Profile {
  fullName: string;
  ntrpRating: string | null;
  communityName: string | null;
  communityId: string | null;
}

interface UpcomingLesson {
  id: string;
  date: string;
  timeStart: string | null;
  lessonType: string;
  coachName: string | null;
}

interface UpcomingReservation {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  courtName: string;
}

function formatDateDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mins = m !== 0 ? `:${String(m).padStart(2, '0')}` : '';
  return `${h12}${mins} ${suffix}`;
}

export default function MeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [nextLesson, setNextLesson] = useState<UpcomingLesson | null | undefined>(undefined);
  const [nextReservation, setNextReservation] = useState<UpcomingReservation | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split('T')[0];

    const [profileRes, membershipRes, lessonRes, reservationRes] = await Promise.all([
      supabase.from('profiles').select('full_name, ntrp_rating').eq('id', user.id).single(),
      supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved').limit(1).maybeSingle(),
      supabase
        .from('lesson_requests')
        .select('id, preferred_date, confirmed_date, preferred_time_start, lesson_type, coach_id')
        .eq('player_id', user.id)
        .in('status', ['approved', 'confirmed'])
        .gte('preferred_date', today)
        .order('preferred_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('id, date, start_time, end_time, courts(name)')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileRes.error && !profileRes.data) {
      setError('Could not load profile.');
      setLoading(false);
      return;
    }

    let communityName: string | null = null;
    let communityId: string | null = null;
    if (membershipRes.data?.hoa_id) {
      const { data: hoa } = await supabase.from('hoas').select('name').eq('id', membershipRes.data.hoa_id).single();
      communityName = hoa?.name ?? null;
      communityId = membershipRes.data.hoa_id;
    }

    setProfile({
      fullName: profileRes.data?.full_name ?? 'Member',
      ntrpRating: profileRes.data?.ntrp_rating != null ? String(profileRes.data.ntrp_rating) : null,
      communityName,
      communityId,
    });

    // Next lesson
    if (lessonRes.data) {
      const lr = lessonRes.data as any;
      let coachName: string | null = null;
      if (lr.coach_id) {
        const { data: cp } = await supabase.from('profiles').select('full_name').eq('id', lr.coach_id).single();
        coachName = cp?.full_name ?? null;
      }
      setNextLesson({
        id: lr.id,
        date: lr.confirmed_date ?? lr.preferred_date,
        timeStart: lr.preferred_time_start ?? null,
        lessonType: lr.lesson_type ?? 'lesson',
        coachName,
      });
    } else {
      setNextLesson(null);
    }

    // Next reservation
    if (reservationRes.data) {
      const rv = reservationRes.data as any;
      setNextReservation({
        id: rv.id,
        date: rv.date,
        startTime: rv.start_time,
        endTime: rv.end_time,
        courtName: rv.courts?.name ?? 'Court',
      });
    } else {
      setNextReservation(null);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => { await supabase.auth.signOut({ scope: 'local' }); },
      },
    ]);
  }

  function getInitials(name: string): string {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>

        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.pagePx }}>

          {loading && <><CardSkeleton /><CardSkeleton /></>}

          {!loading && !!error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={load} activeOpacity={0.7}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && profile && (
            <>
              {/* ── Identity card ──────────────────────────────────── */}
              <View style={styles.identityCard}>
                <View style={styles.avatarCircle}>
                  {profile.fullName ? (
                    <Text style={styles.avatarInitials}>{getInitials(profile.fullName)}</Text>
                  ) : (
                    <UserCircle size={36} color={Colors.cyan} strokeWidth={1.5} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.nameText}>{profile.fullName}</Text>
                  {profile.communityName ? (
                    <View style={styles.communityRow}>
                      <Building2 size={12} color={theme.textMuted} strokeWidth={1.5} />
                      <Text style={styles.communityText} numberOfLines={1}>{profile.communityName}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.communityText, { color: theme.textMuted }]}>No community</Text>
                  )}
                </View>
                {profile.ntrpRating ? (
                  <View style={styles.ntrpBadge}>
                    <Text style={styles.ntrpText}>{profile.ntrpRating}</Text>
                    <Text style={styles.ntrpLabel}>NTRP</Text>
                  </View>
                ) : null}
              </View>

              {/* ── Edit Profile ────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.editProfileBtn}
                onPress={() => router.push('/edit-profile' as any)}
                activeOpacity={0.85}>
                <PenLine size={15} color={Colors.white} strokeWidth={1.5} />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>

              {/* ── UPCOMING ────────────────────────────────────────── */}
              <Text style={styles.sectionLabel}>UPCOMING</Text>

              {/* Next lesson preview */}
              {nextLesson ? (
                <TouchableOpacity
                  style={styles.upcomingCard}
                  onPress={() => router.push('/my-coaching' as any)}
                  activeOpacity={0.8}>
                  <View style={[styles.upcomingIcon, { backgroundColor: 'rgba(45,224,255,0.10)' }]}>
                    <BookOpen size={18} color={Colors.cyan} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingTitle}>
                      {LESSON_TYPE_SHORT[nextLesson.lessonType] ?? 'Lesson'}
                      {nextLesson.coachName ? ` · ${nextLesson.coachName}` : ''}
                    </Text>
                    <Text style={styles.upcomingMeta}>
                      {formatDateDisplay(nextLesson.date)}
                      {nextLesson.timeStart ? ` · ${formatTime12(nextLesson.timeStart)}` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.upcomingEmpty}
                  onPress={() => router.push('/(resident)/coaches' as any)}
                  activeOpacity={0.8}>
                  <BookOpen size={16} color={theme.textMuted} strokeWidth={1.5} />
                  <Text style={styles.upcomingEmptyText}>No upcoming lessons — find a coach</Text>
                  <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
                </TouchableOpacity>
              )}

              {/* Next reservation preview */}
              {nextReservation ? (
                <TouchableOpacity
                  style={styles.upcomingCard}
                  onPress={() => router.push('/my-reservations')}
                  activeOpacity={0.8}>
                  <View style={[styles.upcomingIcon, { backgroundColor: 'rgba(45,107,255,0.10)' }]}>
                    <CalendarDays size={18} color={Colors.blue} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingTitle}>{nextReservation.courtName}</Text>
                    <Text style={styles.upcomingMeta}>
                      {formatDateDisplay(nextReservation.date)} · {formatTime12(nextReservation.startTime)}–{formatTime12(nextReservation.endTime)}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.upcomingEmpty}
                  onPress={() => router.push('/(resident)/courts' as any)}
                  activeOpacity={0.8}>
                  <CalendarDays size={16} color={theme.textMuted} strokeWidth={1.5} />
                  <Text style={styles.upcomingEmptyText}>No court bookings — reserve a court</Text>
                  <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.viewAllLink}
                onPress={() => router.push('/(resident)/match')}
                activeOpacity={0.7}>
                <Swords size={14} color={Colors.cyan} strokeWidth={1.5} />
                <Text style={styles.viewAllText}>View My Matches</Text>
              </TouchableOpacity>

              {/* ── CONNECT ─────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>CONNECT</Text>
              <View style={[styles.navGroup, { borderColor: theme.border }]}>
                <NavRow
                  icon={<MessageCircle size={18} color={Colors.blue} strokeWidth={1.5} />}
                  label="Messages"
                  onPress={() => router.push('/messages')}
                  theme={theme}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <NavRow
                  icon={<Bell size={18} color={Colors.blue} strokeWidth={1.5} />}
                  label="Notifications"
                  onPress={() => router.push('/notifications')}
                  theme={theme}
                />
              </View>

              {/* ── ACCOUNT ─────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ACCOUNT</Text>
              <View style={[styles.navGroup, { borderColor: theme.border }]}>
                <NavRow
                  icon={<Settings size={18} color={theme.textMuted} strokeWidth={1.5} />}
                  label="Settings"
                  onPress={() => router.push('/settings')}
                  theme={theme}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <NavRow
                  icon={<HelpCircle size={18} color={theme.textMuted} strokeWidth={1.5} />}
                  label="Help & Support"
                  onPress={() => router.push('/settings')}
                  theme={theme}
                />
              </View>
            </>
          )}

          {/* Sign out — always visible once loaded */}
          {!loading && (
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
              <LogOut size={18} color={Colors.negative} strokeWidth={1.5} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function NavRow({
  icon, label, onPress, theme,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 }}
      onPress={onPress}
      activeOpacity={0.8}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(154,163,184,0.08)', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: theme.textPrimary }}>
        {label}
      </Text>
      <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen:  { flex: 1, backgroundColor: theme.pageBg },
    body:    { paddingTop: 20, paddingBottom: 100 },

    identityCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14,
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(45,224,255,0.12)',
      borderWidth: 1.5,
      borderColor: 'rgba(45,224,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 20,
      color: Colors.cyan,
    },
    nameText: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    communityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    communityText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      flexShrink: 1,
    },
    ntrpBadge: {
      backgroundColor: 'rgba(45,224,255,0.12)',
      borderRadius: Radius.button,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignItems: 'center',
      flexShrink: 0,
    },
    ntrpText: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: Colors.cyan,
      lineHeight: 22,
    },
    ntrpLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.fg2,
      letterSpacing: 1.5,
    },

    editProfileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 12,
      marginBottom: 28,
    },
    editProfileText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },

    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.8,
      marginBottom: 10,
    },

    // Upcoming previews
    upcomingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 8,
    },
    upcomingIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    upcomingTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    upcomingMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      marginTop: 1,
    },
    upcomingEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 8,
    },
    upcomingEmptyText: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    viewAllLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
      paddingVertical: 10,
      marginBottom: 4,
    },
    viewAllText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },

    // Grouped nav
    navGroup: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: 8,
    },
    divider: { height: 1, marginHorizontal: 16 },

    signOutBtn: {
      marginTop: 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      backgroundColor: 'rgba(255,92,107,0.08)',
    },
    signOutText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.negative,
    },
    errorCard: {
      backgroundColor: 'rgba(255,92,107,0.08)',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.2)',
      padding: 20,
      alignItems: 'center',
      gap: 12,
    },
    errorText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: Colors.negative,
      textAlign: 'center',
    },
    retryText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
  }), [theme]);
}
