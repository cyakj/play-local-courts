import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/context/NativeAuthContext';
import { ArrowLeft, Bell, LifeBuoy, Lock, Moon, Shield, Sun } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const SETTINGS_LINKS = [
  { icon: Bell,     label: 'Notifications', desc: 'Manage alert preferences' },
  { icon: Shield,   label: 'Privacy',       desc: 'Profile visibility settings' },
  { icon: Lock,     label: 'Account',       desc: 'Email, phone, password' },
  { icon: LifeBuoy, label: 'Help & Support', desc: 'FAQ, terms, contact' },
] as const;

export default function SettingsScreen() {
  const { session, loading } = useSession();
  const insets = useSafeAreaInsets();
  const { mode, theme, setTheme } = useTheme();

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  async function doSignOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error('[AUTH] signOut error:', error.message);
  }

  function signOut() {
    if (Platform.OS === 'web') { void doSignOut(); return; }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
    ]);
  }

  async function handleBack() {
    if (router.canGoBack()) { router.back(); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/login' as any); return; }
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const userRoles = (roles ?? []).map((r: any) => r.role as string);
    const isCM = userRoles.some(r => ['admin', 'condo_manager', 'manager', 'hoa_manager', 'board_admin'].includes(r));
    const isCoach = userRoles.includes('coach');
    if (isCM) router.replace('/(cm)' as any);
    else if (isCoach) router.replace('/(coach)' as any);
    else router.replace('/(resident)' as any);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity onPress={() => { void handleBack(); }} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { backgroundColor: theme.pageBg }]} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Appearance */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View testID="theme-toggle" style={[styles.segmentedControl, { backgroundColor: theme.surface2 }]}>
              <TouchableOpacity
                testID="theme-light"
                style={[styles.segment, mode === 'light' && styles.segmentActive]}
                onPress={() => setTheme('light')}
                activeOpacity={0.8}>
                <Sun color={mode === 'light' ? Colors.white : theme.textMuted} size={14} strokeWidth={1.5} />
                <Text style={[styles.segmentLabel, { color: mode === 'light' ? Colors.white : theme.textMuted }]}>
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="theme-dark"
                style={[styles.segment, mode === 'dark' && styles.segmentActive]}
                onPress={() => setTheme('dark')}
                activeOpacity={0.8}>
                <Moon color={mode === 'dark' ? Colors.white : theme.textMuted} size={14} strokeWidth={1.5} />
                <Text style={[styles.segmentLabel, { color: mode === 'dark' ? Colors.white : theme.textMuted }]}>
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings links */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {SETTINGS_LINKS.map(({ icon: Icon, label, desc }, i) => (
              <View key={label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
                  <View style={[styles.linkIconBox, { backgroundColor: theme.surface2 }]}>
                    <Icon color={theme.textMuted} size={16} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.linkLabel, { color: theme.textPrimary }]}>{label}</Text>
                    <Text style={[styles.linkDesc, { color: theme.textMuted }]}>{desc}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutCard}
            onPress={signOut}
            activeOpacity={0.8}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 18,
    color: Colors.white,
  },

  content: { padding: Spacing.pagePx, paddingBottom: 60 },

  sectionLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    letterSpacing: 1.6,
    marginBottom: 10,
  },

  card: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    padding: 4,
  },

  divider: { height: 1, marginHorizontal: 16 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  linkIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  linkLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
  },
  linkDesc: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    marginTop: 1,
  },

  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    margin: 12,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 9,
  },
  segmentActive: { backgroundColor: Colors.blue },
  segmentLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },

  signOutCard: {
    marginTop: 28,
    borderRadius: Radius.card,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,92,107,0.22)',
    backgroundColor: 'rgba(255,92,107,0.08)',
  },
  signOutText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
    color: Colors.negative,
  },
});
