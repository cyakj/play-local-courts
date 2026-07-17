import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { Check, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/context/NativeAuthContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

const REQUIREMENTS: { label: string; test: (v: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /[0-9]/.test(v) },
];

function scorePassword(v: string): number {
  if (!v) return 0;
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: 'Very weak', color: Colors.negative },
  { label: 'Weak', color: Colors.negative },
  { label: 'Fair', color: Colors.volt },
  { label: 'Good', color: Colors.cyan },
  { label: 'Strong', color: Colors.positive },
];

export default function ResetPasswordScreen() {
  const { code, access_token, refresh_token } = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const { markPasswordRecovery } = useSession();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [retryEmail, setRetryEmail] = useState('');
  const [retrySending, setRetrySending] = useState(false);
  const [retrySent, setRetrySent] = useState(false);

  const successScale = useRef(new Animated.Value(0.6)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function setup() {
      try {
        if (code) {
          // PKCE flow — Supabase SDK v2 default. Mark recovery mode before the
          // exchange resolves so the app-wide guard never treats the moment
          // the session becomes available as a normal sign-in.
          markPasswordRecovery();
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(String(code));
          if (codeError) {
            setSessionError('This reset link is invalid or has expired.');
            return;
          }
        } else if (access_token && refresh_token) {
          // Implicit flow fallback. setSession() emits SIGNED_IN rather than
          // PASSWORD_RECOVERY, so the explicit mark below is what keeps this
          // path from being redirected to Home like a normal login.
          markPasswordRecovery();
          const { error: sessError } = await supabase.auth.setSession({
            access_token: String(access_token),
            refresh_token: String(refresh_token),
          });
          if (sessError) {
            setSessionError('This reset link is invalid or has expired.');
            return;
          }
        } else {
          setSessionError('This reset link is invalid or has expired.');
          return;
        }
        setSessionReady(true);
      } catch {
        setSessionError('This reset link is invalid or has expired.');
      }
    }
    setup();
  }, [code, access_token, refresh_token]);

  useEffect(() => {
    if (!success) return;
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [success]);

  const unmetRequirements = useMemo(
    () => REQUIREMENTS.filter((r) => !r.test(password)),
    [password],
  );
  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSave = unmetRequirements.length === 0 && passwordsMatch && !saving;

  async function handleSave() {
    if (saving) return; // guards against double-tap submitting twice
    if (unmetRequirements.length > 0) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
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
    setSuccess(true);
  }

  async function handleFinish() {
    // The recovery session has done its job — sign out so the user re-enters
    // the app with a fresh, normal sign-in using the new password.
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/(auth)/login');
  }

  async function handleRequestNewLink() {
    if (retrySending || !retryEmail.trim()) return;
    setRetrySending(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(retryEmail.trim(), {
      redirectTo: Platform.OS === 'web' ? `${window.location.origin}/reset-password` : 'tenisxnative://reset-password',
    });
    setRetrySending(false);
    if (!resetError) setRetrySent(true);
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
            {success ? (
              <Animated.View style={{ opacity: successOpacity, transform: [{ scale: successScale }], alignItems: 'center' }}>
                <View style={styles.successIconWrap}>
                  <Check color={Colors.positive} size={32} strokeWidth={2.5} />
                </View>
                <Text style={styles.title}>Password updated</Text>
                <Text style={styles.subtitle}>
                  Your TenisX password has been changed successfully. Sign in with your new password to continue.
                </Text>
                <TouchableOpacity style={styles.button} onPress={handleFinish} activeOpacity={0.85}>
                  <Text style={styles.buttonText}>Continue to Sign In</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : sessionError ? (
              <>
                <View style={styles.iconWrap}>
                  <ShieldCheck size={32} color={Colors.negative} strokeWidth={1.5} />
                </View>
                <Text style={styles.title}>Link no longer valid</Text>
                <Text style={styles.subtitle}>{sessionError}</Text>

                {retrySent ? (
                  <View style={[styles.banner, styles.successBanner]}>
                    <Text style={styles.successText}>
                      If an account exists for {retryEmail.trim()}, a new reset link is on its way.
                    </Text>
                  </View>
                ) : (
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
                      style={[styles.button, (!retryEmail.trim() || retrySending) && styles.buttonDisabled]}
                      onPress={handleRequestNewLink}
                      disabled={!retryEmail.trim() || retrySending}
                      activeOpacity={0.85}>
                      <Text style={styles.buttonText}>
                        {retrySending ? 'Sending…' : 'Request another reset email'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.cyanLink}>Back to login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>Create New Password</Text>
                <Text style={styles.subtitle}>
                  {sessionReady
                    ? 'Choose a new password for your TenisX account.'
                    : 'Verifying your reset link…'}
                </Text>

                {!!error && (
                  <View style={[styles.banner, styles.errorBanner]}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {sessionReady && (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>New Password</Text>
                      <View style={styles.inputWrap}>
                        <TextInput
                          style={styles.inputInWrap}
                          placeholder="Min 8 characters"
                          placeholderTextColor={Colors.textPlaceholder}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          editable={!saving}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          {showPassword
                            ? <EyeOff color={Colors.fg2} size={18} strokeWidth={1.8} />
                            : <Eye color={Colors.fg2} size={18} strokeWidth={1.8} />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {password.length > 0 && (
                      <View style={styles.strengthWrap}>
                        <View style={styles.strengthTrack}>
                          {[0, 1, 2, 3].map((i) => (
                            <View
                              key={i}
                              style={[
                                styles.strengthSeg,
                                i < strength && { backgroundColor: STRENGTH_META[strength].color },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.strengthLabel, { color: STRENGTH_META[strength].color }]}>
                          {STRENGTH_META[strength].label}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                      <Text style={styles.fieldLabel}>Confirm Password</Text>
                      <View style={styles.inputWrap}>
                        <TextInput
                          style={styles.inputInWrap}
                          placeholder="Repeat new password"
                          placeholderTextColor={Colors.textPlaceholder}
                          value={confirm}
                          onChangeText={setConfirm}
                          secureTextEntry={!showConfirm}
                          autoCapitalize="none"
                          editable={!saving}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirm((v) => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          {showConfirm
                            ? <EyeOff color={Colors.fg2} size={18} strokeWidth={1.8} />
                            : <Eye color={Colors.fg2} size={18} strokeWidth={1.8} />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {password.length > 0 && (
                      <View style={styles.requirements}>
                        {REQUIREMENTS.map((r) => {
                          const met = r.test(password);
                          return (
                            <View key={r.label} style={styles.requirementRow}>
                              <View style={[styles.requirementDot, met && styles.requirementDotMet]}>
                                {met && <Check color={Colors.pageBg} size={10} strokeWidth={3} />}
                              </View>
                              <Text style={[styles.requirementText, met && { color: Colors.positive }]}>
                                {r.label}
                              </Text>
                            </View>
                          );
                        })}
                        {confirm.length > 0 && (
                          <View style={styles.requirementRow}>
                            <View style={[styles.requirementDot, passwordsMatch && styles.requirementDotMet]}>
                              {passwordsMatch && <Check color={Colors.pageBg} size={10} strokeWidth={3} />}
                            </View>
                            <Text style={[styles.requirementText, passwordsMatch && { color: Colors.positive }]}>
                              Passwords match
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.button, !canSave && styles.buttonDisabled]}
                      onPress={handleSave}
                      disabled={!canSave}
                      activeOpacity={0.85}>
                      <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Create New Password'}</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(auth)/login')}>
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
  successIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(47,217,139,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
    paddingHorizontal: 16,
    gap: 8,
  },
  inputInWrap: {
    flex: 1,
    height: '100%',
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  strengthWrap: { marginTop: 10, marginBottom: 4, gap: 6 },
  strengthTrack: { flexDirection: 'row', gap: 4 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  strengthLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 0.4 },
  requirements: { gap: 8, marginTop: 14, marginBottom: 8 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requirementDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  requirementDotMet: { backgroundColor: Colors.positive, borderColor: Colors.positive },
  requirementText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    color: Colors.fg2,
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
