import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LogOut,
  Settings,
  UserCircle,
} from 'lucide-react-native';
import { router } from 'expo-router';

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
}

export default function MeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

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
    if (membershipRes.data?.hoa_id) {
      const { data: hoa } = await supabase
        .from('hoas')
        .select('name')
        .eq('id', membershipRes.data.hoa_id)
        .single();
      communityName = hoa?.name ?? null;
    }

    setProfile({
      fullName: profileRes.data?.full_name ?? 'Member',
      ntrpRating: profileRes.data?.ntrp_rating != null ? String(profileRes.data.ntrp_rating) : null,
      communityName,
    });
    setLoading(false);
  }

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

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={load}>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>PROFILE</Text>
          <Text style={styles.heroTitle}>My Account</Text>
        </View>

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
              {/* Identity card */}
              <View style={styles.identityCard}>
                <View style={styles.avatarCircle}>
                  <UserCircle size={36} color={Colors.cyan} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.nameText}>{profile.fullName}</Text>
                  {profile.communityName ? (
                    <Text style={styles.communityText}>{profile.communityName}</Text>
                  ) : (
                    <Text style={[styles.communityText, { color: theme.textMuted }]}>No community membership</Text>
                  )}
                </View>
                {profile.ntrpRating ? (
                  <View style={styles.ntrpBadge}>
                    <Text style={styles.ntrpText}>{profile.ntrpRating}</Text>
                    <Text style={styles.ntrpLabel}>NTRP</Text>
                  </View>
                ) : null}
              </View>

              {/* Navigation cards */}
              <Text style={styles.sectionLabel}>ACTIVITY</Text>

              <NavCard
                icon={<CalendarDays size={20} color={Colors.cyan} strokeWidth={1.5} />}
                label="My Reservations"
                onPress={() => router.push('/my-reservations')}
                styles={styles}
              />
              <NavCard
                icon={<ClipboardList size={20} color={Colors.cyan} strokeWidth={1.5} />}
                label="My Reports"
                onPress={() => router.push('/my-reports')}
                styles={styles}
              />

              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ACCOUNT</Text>

              <NavCard
                icon={<Settings size={20} color={Colors.fg2} strokeWidth={1.5} />}
                label="Settings"
                onPress={() => router.push('/settings')}
                styles={styles}
              />
            </>
          )}

          {/* Sign out is always visible so users can log out even when profile fails to load */}
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
    body:    { paddingBottom: 100 },
    hero: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 8,
      paddingBottom: 24,
    },
    heroLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.cyan,
      letterSpacing: 2.2,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 32,
      color: theme.textPrimary,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    identityCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 24,
    },
    avatarCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(45,224,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    nameText: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    communityText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary ?? Colors.fg2,
    },
    ntrpBadge: {
      backgroundColor: 'rgba(45,224,255,0.12)',
      borderRadius: Radius.button,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignItems: 'center',
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
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.fg2,
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
