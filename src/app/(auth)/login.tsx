import { useRef, useState } from 'react';
import {
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
import { router } from 'expo-router';
import { Eye, EyeOff, Lock } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/constants/design';
import { isCMRoutable, isCoachRoutable } from '@/lib/roleRouting';

function OTPInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(TextInput | null)[]>(Array(6).fill(null));
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  return (
    <View style={otpStyles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          style={[otpStyles.box, digit ? otpStyles.boxFilled : null]}
          value={digit}
          maxLength={1}
          keyboardType="number-pad"
          editable={!disabled}
          textAlign="center"
          onChangeText={(text) => {
            const char = text.replace(/\D/g, '').slice(-1);
            if (!char) {
              const arr = [...digits];
              arr[i] = '';
              onChange(arr.join(''));
              if (i > 0) refs.current[i - 1]?.focus();
              return;
            }
            const arr = [...digits];
            arr[i] = char;
            onChange(arr.join(''));
            if (i < 5) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const resendCooldown = useResendCooldown();
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signIn() {
    if (!email.trim() || !password.trim()) return;
    setError('');
    setLoading(true);

    await supabase.auth.signOut({ scope: 'local' });
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes('mfa') || msg.includes('factor')) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.[0];
        if (totpFactor) {
          setMfaFactorId(totpFactor.id);
          setLoading(false);
          return;
        }
      }
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const uid = data.user?.id;
    if (!uid) { setLoading(false); return; }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', uid);
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
    const isCM    = isCMRoutable(roles);
    const isCoach = isCoachRoutable(roles);
    setLoading(false);
    if (isCM)         router.replace('/(cm)');
    else if (isCoach) router.replace('/(coach)');
    else              router.replace('/(resident)');
  }

  async function handleForgotPassword() {
    if (isResetting || resendCooldown.active) return; // guards against double-tap and spamming the rate limit
    if (!email.trim()) {
      setError('Please enter your email address to reset your password');
      return;
    }
    setError('');
    setIsResetting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Platform.OS === 'web' ? `${window.location.origin}/reset-password/confirm` : 'tenisxnative://reset-password/confirm',
    });
    setIsResetting(false);
    if (resetError) {
      // Never reveal whether the email exists — resetPasswordForEmail already
      // doesn't error for unknown addresses, so any error here is a real
      // infra/rate-limit issue and safe to describe.
      if (resetError.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
        resendCooldown.start();
      } else {
        setError(resetError.message);
      }
    } else {
      setSuccessMsg('Password reset email sent. Check your inbox.');
      resendCooldown.start();
    }
  }

  async function handleMFAVerify() {
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaVerifying(true);
    setError('');

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeError) {
      setError(challengeError.message);
      setMfaVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challengeData.id,
      code: mfaCode,
    });

    if (verifyError) {
      setError(verifyError.message || 'Invalid code. Please try again.');
      setMfaCode('');
      setMfaVerifying(false);
      return;
    }

    setMfaVerifying(false);
    // Auth state listener will handle navigation
  }

  if (mfaFactorId) {
    return (
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <View style={styles.mfaIconWrap}>
                <Lock size={24} color={Colors.cyan} strokeWidth={1.75} />
              </View>
              <Text style={[styles.title, { textAlign: 'center', marginTop: 16 }]}>Two-Factor Auth</Text>
              <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: 0 }]}>
                Enter the 6-digit code from your authenticator app
              </Text>

              {!!error && (
                <View style={[styles.banner, styles.errorBanner]}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <OTPInput value={mfaCode} onChange={setMfaCode} disabled={mfaVerifying} />

              <TouchableOpacity
                style={[styles.button, (mfaCode.length !== 6 || mfaVerifying) && styles.buttonDisabled]}
                onPress={handleMFAVerify}
                disabled={mfaCode.length !== 6 || mfaVerifying}
                activeOpacity={0.85}>
                <Text style={styles.buttonText}>{mfaVerifying ? 'Verifying…' : 'Verify'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.centeredLink}
                onPress={() => { setMfaFactorId(null); setMfaCode(''); setError(''); }}>
                <Text style={styles.cyanLink}>Back to login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your TenisX account</Text>

            {!!successMsg && (
              <View style={[styles.banner, styles.successBanner]}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {!!error && (
              <View style={[styles.banner, styles.errorBanner]}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={[styles.input, focused === 'email' && styles.inputFocused]}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textPlaceholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginBottom: 24 }]}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, focused === 'password' && styles.inputFocused]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textPlaceholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword
                    ? <EyeOff size={18} color={Colors.textMuted} strokeWidth={1.8} />
                    : <Eye size={18} color={Colors.textMuted} strokeWidth={1.8} />
                  }
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={signIn}
              disabled={loading}
              activeOpacity={0.85}>
              <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.centeredLink}
              onPress={handleForgotPassword}
              disabled={isResetting || resendCooldown.active}>
              <Text style={[styles.cyanLink, (isResetting || resendCooldown.active) && { opacity: 0.6 }]}>
                {isResetting
                  ? 'Sending reset email…'
                  : resendCooldown.active
                    ? `Resend available in ${resendCooldown.secondsLeft}s`
                    : 'Forgot Password?'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.centeredLink, { marginTop: 20 }]}
              onPress={() => router.push('/hoa-application')}
              activeOpacity={0.7}>
              <Text style={styles.signUpRow}>
                Don't have an account?{' '}
                <Text style={styles.signUpLink}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const otpStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 24,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    fontSize: 24,
    fontFamily: FontFamily.manropeBold,
    color: Colors.navy,
  },
  boxFilled: {
    borderColor: Colors.accentCyan,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.pagePx,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.06)',
    ...Shadow,
  },
  title: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 24,
    color: Colors.navy,
    lineHeight: 29,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  banner: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  successBanner: {
    backgroundColor: '#F0FFFE',
    borderColor: Colors.accentCyan,
  },
  successText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.navy,
  },
  errorBanner: {
    backgroundColor: '#FFF5F5',
    borderColor: '#F97066',
  },
  errorText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: '#C0392B',
  },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.navy,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.15)',
    borderRadius: Radius.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: FontFamily.interRegular,
    color: Colors.navy,
    backgroundColor: Colors.white,
    minHeight: 52,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: Colors.accentCyan,
    borderWidth: 1.5,
  },
  button: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  buttonText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 16,
    color: Colors.white,
  },
  centeredLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  cyanLink: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
    color: Colors.accentCyan,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15,31,61,0.08)',
    marginTop: 24,
    marginBottom: 20,
  },
  signUpRow: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  signUpLink: {
    fontFamily: FontFamily.interSemiBold,
    color: Colors.accentCyan,
  },
  mfaIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
