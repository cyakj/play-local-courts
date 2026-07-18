import { useState } from 'react';
import {
  Image,
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
import { ShieldCheck } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/context/NativeAuthContext';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

type Status = 'idle' | 'verifying' | 'error';

export default function ConfirmPasswordResetScreen() {
  const { token_hash, type } = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const { markPasswordRecovery, clearPasswordRecovery } = useSession();

  // Params are validated once on the first render rather than in an effect —
  // this screen must never call verifyOtp() on its own; it only ever runs
  // from handleContinue(), behind an explicit tap. A GET from an email
  // security scanner that pre-fetches this URL is a no-op.
  const hasValidParams = typeof token_hash === 'string' && token_hash.length > 0 && type === 'recovery';

  const [status, setStatus] = useState<Status>(hasValidParams ? 'idle' : 'error');

  const [retryEmail, setRetryEmail] = useState('');
  const [retrySending, setRetrySending] = useState(false);
  const [retrySent, setRetrySent] = useState(false);
  const [retryError, setRetryError] = useState('');
  const retryCooldown = useResendCooldown();

  async function handleContinue() {
    if (status === 'verifying') return; // guards against double-tap redeeming the token twice
    if (!hasValidParams) {
      setStatus('error');
      return;
    }
    setStatus('verifying');
    const { error } = await supabase.auth.verifyOtp({
      token_hash: String(token_hash),
      type: 'recovery',
    });
    if (error) {
      setStatus('error');
      return;
    }
    // verifyOtp() with type: 'recovery' fires a PASSWORD_RECOVERY auth event,
    // but the explicit mark keeps this in lockstep with the rest of the app's
    // recovery-guard pattern (see reset-password/index.tsx and _layout.tsx).
    markPasswordRecovery();
    router.replace('/reset-password');
  }

  function handleBackToLogin() {
    clearPasswordRecovery();
    router.replace('/(auth)/login');
  }

  async function handleRequestNewLink() {
    if (retrySending || retryCooldown.active || !retryEmail.trim()) return;
    setRetrySending(true);
    setRetryError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(retryEmail.trim(), {
      redirectTo: Platform.OS === 'web' ? `${window.location.origin}/reset-password/confirm` : 'tenisxnative://reset-password/confirm',
    });
    setRetrySending(false);
    if (resetError) {
      // Never reveal whether the email exists — resetPasswordForEmail already
      // doesn't error for unknown addresses, so any error here is a real
      // infra/rate-limit issue and safe to describe.
      if (resetError.status === 429) {
        setRetryError('Too many requests. Please wait a moment and try again.');
        retryCooldown.start();
      } else {
        setRetryError(resetError.message);
      }
      return;
    }
    setRetrySent(true);
    retryCooldown.start();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Image
            source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.card}>
            {status === 'error' ? (
              <>
                <View style={styles.iconWrap}>
                  <ShieldCheck size={32} color={Colors.negative} strokeWidth={1.5} />
                </View>
                <Text style={styles.title}>Link no longer valid</Text>
                <Text style={styles.subtitle}>This reset link is invalid or has expired.</Text>

                {!!retryError && (
                  <View style={[styles.banner, styles.errorBanner]}>
                    <Text style={styles.errorText}>{retryError}</Text>
                  </View>
                )}

                {retrySent && (
                  <View style={[styles.banner, styles.successBanner]}>
                    <Text style={styles.successText}>
                      If an account exists for {retryEmail.trim()}, a new reset link is on its way.
                    </Text>
                  </View>
                )}

                {(!retrySent || !retryCooldown.active) && (
                  <>
                    <View style={[styles.fieldGroup, { marginTop: 8 }]}>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="your@email.com"
                        placeholderTextColor={Colors.textPlaceholder}
                        value={retryEmail}
                        onChangeText={setRetryEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!retrySending}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.button, (!retryEmail.trim() || retrySending || retryCooldown.active) && styles.buttonDisabled]}
                      onPress={handleRequestNewLink}
                      disabled={!retryEmail.trim() || retrySending || retryCooldown.active}
                      activeOpacity={0.85}>
                      <Text style={styles.buttonText}>
                        {retrySending
                          ? 'Sending…'
                          : retryCooldown.active
                            ? `Resend available in ${retryCooldown.secondsLeft}s`
                            : 'Request another reset email'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity style={styles.backLink} onPress={handleBackToLogin} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}>
                  <Text style={styles.cyanLink}>Back to login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.iconWrap}>
                  <ShieldCheck size={32} color={Colors.cyan} strokeWidth={1.5} />
                </View>
                <Text style={styles.title}>Confirm Password Reset</Text>
                <Text style={styles.subtitle}>
                  For your security, press Continue below to create a new password.
                </Text>

                <TouchableOpacity
                  style={[styles.button, status === 'verifying' && styles.buttonDisabled]}
                  onPress={handleContinue}
                  disabled={status === 'verifying'}
                  activeOpacity={0.85}>
                  <Text style={styles.buttonText}>
                    {status === 'verifying' ? 'Verifying…' : 'Continue to Reset Password'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={handleBackToLogin} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}>
                  <Text style={styles.cyanLink}>Back to login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.pagePx },
  logo: { width: 120, height: 48, alignSelf: 'center', marginBottom: 24 },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
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
    marginTop: 6,
    marginBottom: 20,
  },
  banner: { borderRadius: Radius.button, padding: 12, marginBottom: 16, gap: 6 },
  errorBanner: { backgroundColor: 'rgba(255,92,107,0.12)' },
  errorText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    color: Colors.negative,
  },
  successBanner: { backgroundColor: 'rgba(47,217,139,0.12)' },
  successText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    color: Colors.positive,
    textAlign: 'center',
  },
  fieldGroup: { gap: 6, marginBottom: 4 },
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
    marginTop: 16,
    width: '100%',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
    color: Colors.white,
  },
  backLink: { alignItems: 'center', marginTop: 20 },
  cyanLink: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.cyan,
  },
});
