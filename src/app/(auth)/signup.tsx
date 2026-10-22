import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MailCheck } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { buildSignupOptions, validateSignup } from '@/lib/communityJoinLogic';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

// Resident account only. HOA Admin and TenisX Platform Management are separate account types and are not
// created here; no role/community/status is ever sent from the client.
function confirmRedirect(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'tenisxnative://';
}

export default function ResidentSignupScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const cooldown = useResendCooldown();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSignUp() {
    if (submitting) return; // double-tap guard
    const invalid = validateSignup({ fullName, email, password });
    if (invalid) { setError(invalid); return; }
    setError('');
    setSubmitting(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: buildSignupOptions(fullName, confirmRedirect()),
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.status === 429
        ? 'Too many attempts. Please wait a moment and try again.'
        : signUpError.message);
      return;
    }
    // With email confirmation on, no session is returned: the user must verify before signing in.
    // (If a session IS returned, AuthLayout redirects into the app on its own.)
    // The same screen is shown whether or not the address already has an account, so it never reveals which do.
    setAwaitingVerification(true);
    cooldown.start();
  }

  async function handleResend() {
    if (resending || cooldown.active) return;
    setResending(true);
    setNote('');
    setError('');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: confirmRedirect() },
    });
    setResending(false);
    if (resendError) {
      if (resendError.status === 429) cooldown.start();
      setError(resendError.status === 429 ? 'Too many requests. Please wait a moment.' : resendError.message);
      return;
    }
    setNote('Verification email sent.');
    cooldown.start();
  }

  if (awaitingVerification) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View testID="verify-email-card" style={styles.card}>
            <View style={styles.iconWrap}><MailCheck size={26} color={Colors.cyan} strokeWidth={1.75} /></View>
            <Text style={[styles.title, styles.center]}>Check your email</Text>
            <Text style={[styles.body, styles.center]}>
              We sent a verification link to {email.trim()}. Open it to verify your address, then sign in to find your community.
            </Text>
            {!!note && <Text style={[styles.note, styles.center]}>{note}</Text>}
            {!!error && <Text style={[styles.error, styles.center]}>{error}</Text>}
            <Button
              variant="ghost"
              label={resending ? 'Sending…' : cooldown.active ? `Resend in ${cooldown.secondsLeft}s` : 'Resend email'}
              onPress={handleResend}
              disabled={resending || cooldown.active}
              fullWidth
            />
            <Button variant="primary" label="Back to sign in" onPress={() => router.replace('/(auth)/login')} fullWidth />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Create your resident account</Text>
            <Text style={styles.body}>
              Sign up, verify your email, then find your community and request to join.
            </Text>

            {!!error && <Text testID="signup-error" style={styles.error}>{error}</Text>}

            <Text style={styles.label}>Full name</Text>
            <TextInput
              testID="signup-name"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              editable={!submitting}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="signup-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!submitting}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="signup-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              editable={!submitting}
            />

            <Button
              variant="primary"
              label={submitting ? 'Creating account…' : 'Create account'}
              onPress={handleSignUp}
              loading={submitting}
              fullWidth
            />

            <TouchableOpacity style={styles.link} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.pagePx, paddingVertical: 40 },
    card: {
      width: '100%', maxWidth: MaxWidth, alignSelf: 'center', gap: 12,
      backgroundColor: theme.cardBg, borderRadius: Radius.card, padding: 24,
      borderWidth: 1, borderColor: theme.border, ...theme.shadowCard,
    },
    iconWrap: {
      width: 52, height: 52, borderRadius: 26, alignSelf: 'center',
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(45,224,255,0.12)',
    },
    title: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary },
    body: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textSecondary, lineHeight: 22 },
    center: { textAlign: 'center' },
    label: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textSecondary, marginTop: 4 },
    input: {
      minHeight: 52, borderWidth: 1, borderColor: theme.border, borderRadius: Radius.input,
      paddingHorizontal: 16, fontSize: 16, fontFamily: FontFamily.manropeMedium,
      color: theme.textPrimary, backgroundColor: theme.inputBg,
    },
    error: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: Colors.negative },
    note: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: Colors.positive },
    link: { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
    linkText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textMuted },
    linkBold: { fontFamily: FontFamily.manropeSemiBold, color: Colors.cyan },
  }), [theme]);
}
