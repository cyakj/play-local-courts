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

interface Profile {
  fullName: string;
  ntrpRating: string | null;
  communityName: string | null;
  communityId: string | null;
}

export default function MeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, membershipRes] = await Promise.all([
      supabase.from('profiles').select('full_name, ntrp_rating').eq('id', user.id).single(),
      supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved').limit(1).single(),
    ]);

    if (profileRes.error && !profileRes.data) {
      setError('Could not load profile. Pull down to retry.');
      setLoading(false);
      return;
    }

    let communityName: string | null = null;
    let communityId: string | null = null;
    if (membershipRes.data?.hoa_id) {
      const { data: hoa } = await supabase
        .from('hoas')
        .select('name')
        .eq('id', membershipRes.data.hoa_id)
        .single();
      communityName = hoa?.name ?? null;
      communityId = membershipRes.data.hoa_id;
    }

    setProfile({
      fullName: profileRes.data?.full_name ?? 'Member',
      ntrpRating: profileRes.data?.ntrp_rating != null ? String(profileRes.data.ntrp_rating) : null,
      communityName,
      communityId,
    });
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
              {/* ── Identity card ────────────────────────────────────────── */}
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
                    <Text style={styles.communityText}>{profile.communityName}</Text>
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

              {/* ── Edit Profile ──────────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.editProfileBtn}
                onPress={() => router.push('/edit-profile' as any)}
                activeOpacity={0.85}>
                <PenLine size={15} color={Colors.white} strokeWidth={1.5} />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>

              {/* ── ACTIVITY ─────────────────────────────────────────────── */}
              <Text style={styles.sectionLabel}>ACTIVITY</Text>

              <NavCard
                icon={<Swords size={20} color={Colors.cyan} strokeWidth={1.5} />}
                label="My Matches"
                onPress={() => router.push('/(resident)/match')}
                styles={styles}
              />
              <NavCard
                icon={<BookOpen size={20} color={Colors.cyan} strokeWidth={1.5} />}
                label="My Lessons"
                onPress={() => router.push('/my-coaching' as any)}
                styles={styles}
              />
              <NavCard
                icon={<CalendarDays size={20} color={Colors.cyan} strokeWidth={1.5} />}
                label="My Reservations"
                onPress={() => router.push('/my-reservations')}
                styles={styles}
              />

              {/* ── CONNECT ──────────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>CONNECT</Text>

              <NavCard
                icon={<MessageCircle size={20} color={Colors.blue} strokeWidth={1.5} />}
                label="Messages"
                onPress={() => router.push('/messages')}
                styles={styles}
              />
              <NavCard
                icon={<Bell size={20} color={Colors.blue} strokeWidth={1.5} />}
                label="Notifications"
                onPress={() => router.push('/notifications')}
                styles={styles}
              />

              {/* ── COMMUNITY ────────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>COMMUNITY</Text>

              {profile.communityName ? (
                <View style={styles.communityCard}>
                  <Building2 size={18} color={Colors.cyan} strokeWidth={1.5} />
                  <Text style={styles.communityCardName} numberOfLines={1}>{profile.communityName}</Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.joinCommunityBtn}
                onPress={() => router.push('/hoa-application')}
                activeOpacity={0.7}>
                <Text style={styles.joinCommunityText}>+ Join or apply to a community</Text>
              </TouchableOpacity>

              {/* ── ACCOUNT ──────────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ACCOUNT</Text>

              <NavCard
                icon={<Settings size={20} color={theme.textMuted} strokeWidth={1.5} />}
                label="Settings"
                onPress={() => router.push('/settings')}
                styles={styles}
              />
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

function NavCard({
  icon,
  label,
  onPress,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}) {
  return (
    <TouchableOpacity style={styles.navCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.navIcon}>{icon}</View>
      <Text style={styles.navLabel}>{label}</Text>
      <ChevronRight size={16} color={Colors.fg2} strokeWidth={1.5} />
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
    communityText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
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
    navCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 8,
      minHeight: 52,
    },
    navIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(45,224,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navLabel: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },

    communityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
    },
    communityCardName: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    activePill: {
      backgroundColor: 'rgba(45,224,255,0.12)',
      borderRadius: Radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    activePillText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.cyan,
      letterSpacing: 1.2,
    },
    joinCommunityBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 4,
    },
    joinCommunityText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },

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
