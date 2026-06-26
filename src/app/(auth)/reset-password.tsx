import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyRound } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

export default function ResetPasswordScreen() {
  const { code, access_token, refresh_token } = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function setup() {
      try {
        if (code) {
          // PKCE flow — Supabase SDK v2 default
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(String(code));
          if (codeError) { setSessionError(codeError.message); return; }
        } else if (access_token && refresh_token) {
          // Implicit flow fallback
          const { error: sessError } = await supabase.auth.setSession({
            access_token: String(access_token),
            refresh_token: String(refresh_token),
          });
          if (sessError) { setSessionError(sessError.message); return; }
        } else {
          setSessionError('Invalid or expired reset link. Please request a new one.');
          return;
        }
        setSessionReady(true);
      } catch {
        setSessionError('Something went wrong. Please request a new reset link.');
      }
    }
    setup();
  }, [code, access_token, refresh_token]);

  async function handleSave() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    Alert.alert(
      'Password updated',
      'Your password has been changed. Please sign in.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <KeyRound size={32} color={Colors.cyan} strokeWidth={1.5} />
            </View>

            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>Choose a strong password for your TenisX account.</Text>

            {!!sessionError && (
              <View style={[styles.banner, styles.errorBanner]}>
                <Text style={styles.errorText}>{sessionError}</Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.cyanLink}>Back to login</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!error && (
              <View style={[styles.banner, styles.errorBanner]}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {sessionReady && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Min 8 characters"
                    placeholderTextColor={Colors.textPlaceholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!saving}
                  />
                </View>

                <View style={[styles.fieldGroup, { marginBottom: 24 }]}>
                  <Text style={styles.fieldLabel}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Repeat new password"
                    placeholderTextColor={Colors.textPlaceholder}
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    editable={!saving}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, (saving || !password || !confirm) && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving || !password || !confirm}
                  activeOpacity={0.85}>
                  <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Update password'}</Text>
                </TouchableOpacity>
              </>
            )}

            {!sessionReady && !sessionError && (
              <Text style={styles.subtitle}>Verifying reset link…</Text>
            )}

            <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.cyanLink}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.pagePx },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    gap: 8,
  },
  iconWrap: { alignItems: 'center', marginBottom: 8 },
  title: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.pageTitle,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: Colors.fg2,
    textAlign: 'center',
    marginBottom: 16,
  },
  banner: { borderRadius: Radius.button, padding: 12, marginBottom: 8, gap: 6 },
  errorBanner: { backgroundColor: 'rgba(255,92,107,0.12)' },
  errorText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    color: Colors.negative,
  },
  fieldGroup: { gap: 6, marginBottom: 12 },
  fieldLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.fg2,
  },
  input: {
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
    paddingHorizontal: 16,
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  button: {
    height: 52,
    borderRadius: Radius.button,
    backgroundColor: Colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
    color: Colors.white,
  },
  backLink: { alignItems: 'center', marginTop: 16 },
  cyanLink: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.cyan,
  },
});
