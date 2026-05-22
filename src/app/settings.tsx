import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User, Mail, LogOut, ChevronRight, Bell, Shield, HelpCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';

interface Profile {
  full_name: string | null;
  email: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile>({ full_name: null, email: null });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setProfile({ full_name: data?.full_name ?? null, email: user.email ?? null });
    }
    load();
  }, []);

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const name = profile.full_name ?? 'User';
  const initials = getInitials(name);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{name}</Text>
              {profile.email && (
                <Text style={styles.profileEmail}>{profile.email}</Text>
              )}
            </View>
          </View>

          {/* Account section */}
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuRow}>
              <User color={Colors.navy} size={18} strokeWidth={1.5} />
              <Text style={styles.menuLabel}>Edit Profile</Text>
              <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuRow}>
              <Mail color={Colors.navy} size={18} strokeWidth={1.5} />
              <Text style={styles.menuLabel}>Change Email</Text>
              <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Preferences section */}
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuRow}>
              <Bell color={Colors.navy} size={18} strokeWidth={1.5} />
              <Text style={styles.menuLabel}>Notification Preferences</Text>
              <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuRow}>
              <Shield color={Colors.navy} size={18} strokeWidth={1.5} />
              <Text style={styles.menuLabel}>Privacy</Text>
              <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Support section */}
          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuRow}>
              <HelpCircle color={Colors.navy} size={18} strokeWidth={1.5} />
              <Text style={styles.menuLabel}>Help & FAQ</Text>
              <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <LogOut color={Colors.coral} size={18} strokeWidth={1.5} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  header: {
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 20,
    marginBottom: 28,
    ...Shadow,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontFamily: FontFamily.manropeExtraBold, fontSize: 22, color: Colors.white },
  profileName: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.cardTitle, color: Colors.navy },
  profileEmail: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted, marginTop: 2 },
  sectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  menuLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, flex: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.coral },
});
