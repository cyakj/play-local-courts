import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/context/NativeAuthContext';
import {
  ArrowLeft, Bell, ChevronRight, LifeBuoy, Lock, Shield, Sun, Moon,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

interface Profile {
  full_name: string | null;
  email: string | null;
}

interface Membership {
  id: string;
  hoa_id: string;
  hoa_name: string;
  role: string;
  status: 'active' | 'pending' | string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SettingsScreen() {
  const { session, loading } = useSession();
  const insets = useSafeAreaInsets();
  const { mode, theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile>({ full_name: null, email: null });
  const [memberships, setMemberships] = useState<Membership[]>([]);

  // All hooks must run before any early returns
  useEffect(() => {
    if (!session) return;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase
          .from('hoa_memberships')
          .select('id, hoa_id, role, status, hoas(name)')
          .eq('user_id', user.id),
      ]);

      setProfile({ full_name: profileRes.data?.full_name ?? null, email: user.email ?? null });

      const mapped: Membership[] = (membersRes.data ?? []).map((m: any) => ({
        id: m.id,
        hoa_id: m.hoa_id,
        hoa_name: m.hoas?.name ?? 'Unknown',
        role: m.role ?? 'member',
        status: m.status ?? 'active',
      }));
      setMemberships(mapped);
    }
    load();
  }, [session]);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  function signOut() {
    console.log('[AUTH] Sign out button pressed (Settings)');
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          console.log('[AUTH] supabase.auth.signOut() called');
          const { error } = await supabase.auth.signOut({ scope: 'local' });
          if (error) console.error('[AUTH] signOut error:', error.message);
          else console.log('[AUTH] signOut completed — awaiting SIGNED_OUT event → AuthGuard redirect');
        },
      },
    ]);
  }

  const name = profile.full_name ?? 'User';
  const initials = getInitials(name);
  const activeMemberships = memberships.filter((m) => m.status === 'approved');
  const pendingMemberships = memberships.filter((m) => m.status === 'pending');
  const activeHOA = activeMemberships[0];

  const settingsLinks = [
    { icon: Bell, label: 'Notifications', desc: 'Manage alert preferences' },
    { icon: Shield, label: 'Privacy', desc: 'Profile visibility settings' },
    { icon: Lock, label: 'Account', desc: 'Email, phone, password' },
    { icon: LifeBuoy, label: 'Help & Support', desc: 'FAQ, terms, contact' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Auth debug panel — DEV only */}
          {__DEV__ && (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>DEV · AUTH STATE</Text>
              <Text style={styles.debugLine}>session: {session ? 'PRESENT' : 'NULL'}</Text>
              <Text style={styles.debugLine}>user: {session?.user?.email ?? '—'}</Text>
              <Text style={styles.debugLine}>loading: {String(loading)}</Text>
            </View>
          )}

          {/* Profile card */}
          <View style={[styles.profileCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: theme.textPrimary }]}>{name}</Text>
                {activeHOA && (
                  <Text style={styles.profileHoa}>{activeHOA.hoa_name}</Text>
                )}
                {profile.email && (
                  <Text style={styles.profileEmail}>{profile.email}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.8}>
              <Text style={styles.editProfileLabel}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* My Communities */}
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>My Communities</Text>
            {activeMemberships.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.communityRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.communityNameRow}>
                      <Text style={styles.communityName}>{m.hoa_name}</Text>
                      {i === 0 && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.communityRole}>{m.role}</Text>
                  </View>
                </View>
              </View>
            ))}
            {pendingMemberships.map((m, i) => (
              <View key={m.id}>
                {(activeMemberships.length > 0 || i > 0) && <View style={styles.divider} />}
                <View style={styles.communityRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.communityName}>{m.hoa_name}</Text>
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>Pending</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => router.push('/hoa-application')}
              activeOpacity={0.7}>
              <Text style={styles.joinBtnText}>+ Join or apply to a new community</Text>
            </TouchableOpacity>
          </View>

          {/* Appearance */}
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              <Text style={styles.appearanceEyebrow}>APPEARANCE</Text>
            </Text>
            <View testID="theme-toggle" style={[styles.segmentedControl, { backgroundColor: theme.surface2 }]}>
              <TouchableOpacity
                testID="theme-light"
                style={[styles.segment, mode === 'light' && styles.segmentActive]}
                onPress={() => setTheme('light')}
                activeOpacity={0.8}>
                <Sun color={mode === 'light' ? Colors.white : theme.textMuted} size={14} strokeWidth={1.5} />
                <Text style={[styles.segmentLabel, mode === 'light' && styles.segmentLabelActive, { color: mode === 'light' ? Colors.white : theme.textMuted }]}>
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="theme-dark"
                style={[styles.segment, mode === 'dark' && styles.segmentActive]}
                onPress={() => setTheme('dark')}
                activeOpacity={0.8}>
                <Moon color={mode === 'dark' ? Colors.white : theme.textMuted} size={14} strokeWidth={1.5} />
                <Text style={[styles.segmentLabel, mode === 'dark' && styles.segmentLabelActive, { color: mode === 'dark' ? Colors.white : theme.textMuted }]}>
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings links */}
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            {settingsLinks.map(({ icon: Icon, label, desc }, i) => (
              <View key={label}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
                  <View style={styles.linkIconBox}>
                    <Icon color={Colors.textMuted} size={16} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.linkLabel, { color: theme.textPrimary }]}>{label}</Text>
                    <Text style={styles.linkDesc}>{desc}</Text>
                  </View>
                  <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutCard} onPress={signOut} activeOpacity={0.8}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    backgroundColor: Colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },

  content: { padding: Spacing.pagePx, paddingBottom: 60, gap: 16 },

  profileCard: {
    backgroundColor: Colors.cardBg, // overridden inline with theme.cardBg
    borderRadius: Radius.card,
    padding: 20,
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.navy,
    borderWidth: 2,
    borderColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontFamily: FontFamily.manropeExtraBold, fontSize: 20, color: Colors.white },
  profileName: { fontFamily: FontFamily.manropeExtraBold, fontSize: 17, color: Colors.navy },
  profileHoa: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.accentCyan, marginTop: 2 },
  profileEmail: { fontFamily: FontFamily.interRegular, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  editProfileBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editProfileLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.white },

  card: {
    backgroundColor: Colors.cardBg, // overridden inline with theme.cardBg
    borderRadius: Radius.card,
    overflow: 'hidden',
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.navy,
    padding: 16,
    paddingBottom: 12,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  communityRow: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  communityNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityName: { fontFamily: FontFamily.interSemiBold, fontSize: 14, color: Colors.navy },
  communityRole: { fontFamily: FontFamily.interRegular, fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  activePill: {
    backgroundColor: Colors.accentCyan + '20',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activePillText: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: Colors.accentCyan },
  pendingPill: {
    backgroundColor: '#FEF9C3',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  pendingPillText: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: '#92400E' },
  joinBtn: { padding: 16, alignItems: 'center' },
  joinBtnText: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.accentCyan },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16, minHeight: 56 },
  linkIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  linkLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 14, color: Colors.textPrimary },
  linkDesc: { fontFamily: FontFamily.interRegular, fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  debugPanel: {
    backgroundColor: '#0A1628',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2DE0FF40',
    marginBottom: 4,
  },
  debugTitle: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 10,
    color: '#2DE0FF',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  debugLine: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    color: '#9AA3B8',
    lineHeight: 18,
  },

  signOutCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.card,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.13)',
  },
  signOutText: { fontFamily: FontFamily.manropeExtraBold, fontSize: 15, color: Colors.red },

  // Appearance segmented control
  appearanceEyebrow: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: Colors.cyan,
    letterSpacing: 1.8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    marginTop: 12,
    marginBottom: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: Colors.blue,
  },
  segmentLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },
  segmentLabelActive: {
    color: Colors.white,
  },
});
