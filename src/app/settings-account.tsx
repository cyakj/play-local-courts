import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, LogOut, Mail, Phone } from 'lucide-react-native';

import { useSession } from '@/context/NativeAuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

export default function SettingsAccountScreen() {
  const { session, loading } = useSession();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [phone, setPhone] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('phone_number')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setPhone(data?.phone_number ?? null));
  }, [session?.user.id]);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  const email = session.user.email ?? '—';

  async function sendPasswordReset() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'tenisx://reset-password',
    });
    if (error) {
      Alert.alert('Error', 'Could not send reset email. Please try again.');
    } else {
      setResetSent(true);
      Alert.alert('Email sent', `A password reset link has been sent to ${email}.`);
    }
  }

  function confirmSignOut() {
    if (Platform.OS === 'web') { void doSignOut(); return; }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
    ]);
  }

  async function doSignOut() {
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/settings' as any); }}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Identity */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>IDENTITY</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.infoRow}>
              <View style={[styles.iconBox, { backgroundColor: theme.surface2 }]}>
                <Mail color={theme.textMuted} size={16} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>EMAIL</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{email}</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <View style={[styles.iconBox, { backgroundColor: theme.surface2 }]}>
                <Phone color={theme.textMuted} size={16} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>PHONE</Text>
                <Text style={[styles.infoValue, { color: phone ? theme.textPrimary : theme.textMuted }]}>
                  {phone ?? 'Not set'}
                </Text>
              </View>
            </View>
          </View>

          {/* Security */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>SECURITY</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={sendPasswordReset}
              disabled={resetSent}
              activeOpacity={0.7}>
              <Text style={[styles.actionLabel, { color: resetSent ? theme.textMuted : Colors.blue }]}>
                {resetSent ? 'Reset email sent' : 'Change Password'}
              </Text>
              {!resetSent && (
                <Text style={[styles.actionDesc, { color: theme.textMuted }]}>
                  A reset link will be sent to your email
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutCard} onPress={confirmSignOut} activeOpacity={0.8}>
            <LogOut color={Colors.negative} size={18} strokeWidth={1.5} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx, paddingBottom: 14,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: Colors.white },

    content: { padding: Spacing.pagePx, paddingBottom: 60 },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow,
      letterSpacing: 1.6, marginBottom: 10,
    },
    card: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
    divider: { height: 1, marginHorizontal: 16 },

    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 14, minHeight: 60,
    },
    iconBox: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    infoLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, letterSpacing: 1.2, marginBottom: 2,
    },
    infoValue: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },

    actionRow: { paddingHorizontal: 16, paddingVertical: 16, minHeight: 56, justifyContent: 'center' },
    actionLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    actionDesc:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },

    signOutCard: {
      marginTop: 28, borderRadius: Radius.card, paddingVertical: 18,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1, borderColor: 'rgba(255,92,107,0.22)',
      backgroundColor: 'rgba(255,92,107,0.08)',
    },
    signOutText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.negative },
  }), [theme]);
}
