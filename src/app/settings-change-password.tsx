import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Eye, EyeOff, KeyRound } from 'lucide-react-native';

import { useSession } from '@/context/NativeAuthContext';
import { supabase } from '@/lib/supabase';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const REQUIREMENTS: { label: string; test: (v: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /[0-9]/.test(v) },
];

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggleVisible,
  editable,
  theme,
  styles,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  editable: boolean;
  theme: ThemeTokens;
  styles: ReturnType<typeof useStyles>;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          editable={editable}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={onToggleVisible} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {visible
            ? <EyeOff color={theme.textMuted} size={18} strokeWidth={1.8} />
            : <Eye color={theme.textMuted} size={18} strokeWidth={1.8} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsChangePasswordScreen() {
  const { session, loading } = useSession();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const resendCooldown = useResendCooldown();

  const unmetRequirements = useMemo(
    () => REQUIREMENTS.filter((r) => !r.test(newPassword)),
    [newPassword],
  );
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSave = !!currentPassword && unmetRequirements.length === 0 && passwordsMatch && !saving;

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  async function handleSave() {
    if (saving) return; // guards against double-tap submitting twice
    if (!session?.user.email) return;
    setError('');

    if (unmetRequirements.length > 0) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);

    // The installed @supabase/supabase-js client (2.106.1) accepts a
    // current_password field on updateUser(), but the server only verifies it
    // when the project's "Secure password change" GoTrue setting is enabled —
    // a Dashboard-only toggle, not something exposed in config.toml. Rather
    // than flip that project-wide security policy blind, we independently
    // guarantee "wrong current password fails clearly" by re-authenticating
    // with it first. current_password is still passed through below so this
    // becomes fully server-verified for free if that setting is ever enabled.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setSaving(false);
      setError('Current password is incorrect.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
  }

  async function handleForgotCurrentPassword() {
    if (forgotSending || resendCooldown.active || !session?.user.email) return;
    setForgotSending(true);
    setForgotError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: Platform.OS === 'web' ? `${window.location.origin}/reset-password/confirm` : 'tenisxnative://reset-password/confirm',
    });
    setForgotSending(false);
    if (resetError) {
      if (resetError.status === 429) {
        setForgotError('Too many requests. Please wait a moment and try again.');
        resendCooldown.start();
      } else {
        setForgotError(resetError.message);
      }
    } else {
      setForgotSent(true);
      resendCooldown.start();
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/settings-account' as any); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

            {success ? (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, alignItems: 'center', paddingVertical: 32 }]}>
                <View style={[styles.successIconWrap]}>
                  <Check color={Colors.positive} size={28} strokeWidth={2} />
                </View>
                <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Password updated successfully</Text>
                <Text style={[styles.successSubtitle, { color: theme.textMuted }]}>
                  Your password has been changed. You'll stay signed in on this device.
                </Text>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => router.back()}
                  activeOpacity={0.85}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.iconWrap}>
                  <KeyRound color={Colors.cyan} size={26} strokeWidth={1.5} />
                </View>

                {!!error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <PasswordField
                  label="CURRENT PASSWORD"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  visible={showCurrent}
                  onToggleVisible={() => setShowCurrent((v) => !v)}
                  editable={!saving}
                  theme={theme}
                  styles={styles}
                  placeholder="Enter current password"
                />

                {!!forgotError && (
                  <Text style={[styles.forgotSentText, { color: Colors.negative }]}>{forgotError}</Text>
                )}
                {forgotSent && (
                  <Text style={[styles.forgotSentText]}>
                    Password reset link sent to {session.user.email}.
                  </Text>
                )}
                {(!forgotSent || !resendCooldown.active) && (
                  <TouchableOpacity
                    onPress={handleForgotCurrentPassword}
                    disabled={forgotSending || resendCooldown.active}
                    style={styles.forgotLinkWrap}>
                    <Text style={[styles.forgotLink, (forgotSending || resendCooldown.active) && { opacity: 0.6 }]}>
                      {forgotSending
                        ? 'Sending…'
                        : resendCooldown.active
                          ? `Resend available in ${resendCooldown.secondsLeft}s`
                          : forgotSent
                            ? 'Resend password reset email'
                            : 'Forgot your current password? Send password reset email'}
                    </Text>
                  </TouchableOpacity>
                )}

                <PasswordField
                  label="NEW PASSWORD"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  visible={showNew}
                  onToggleVisible={() => setShowNew((v) => !v)}
                  editable={!saving}
                  theme={theme}
                  styles={styles}
                  placeholder="Min 8 characters"
                />

                <PasswordField
                  label="CONFIRM NEW PASSWORD"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  visible={showConfirm}
                  onToggleVisible={() => setShowConfirm((v) => !v)}
                  editable={!saving}
                  theme={theme}
                  styles={styles}
                  placeholder="Repeat new password"
                />

                {newPassword.length > 0 && (
                  <View style={styles.requirements}>
                    {REQUIREMENTS.map((r) => {
                      const met = r.test(newPassword);
                      return (
                        <View key={r.label} style={styles.requirementRow}>
                          <View style={[styles.requirementDot, met && styles.requirementDotMet]}>
                            {met && <Check color={Colors.pageBg} size={10} strokeWidth={3} />}
                          </View>
                          <Text style={[styles.requirementText, { color: met ? Colors.positive : theme.textMuted }]}>
                            {r.label}
                          </Text>
                        </View>
                      );
                    })}
                    {confirmPassword.length > 0 && (
                      <View style={styles.requirementRow}>
                        <View style={[styles.requirementDot, passwordsMatch && styles.requirementDotMet]}>
                          {passwordsMatch && <Check color={Colors.pageBg} size={10} strokeWidth={3} />}
                        </View>
                        <Text style={[styles.requirementText, { color: passwordsMatch ? Colors.positive : theme.textMuted }]}>
                          Passwords match
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.saveCta, !canSave && styles.saveCtaDisabled]}
                  onPress={handleSave}
                  disabled={!canSave}
                  activeOpacity={0.85}>
                  <Text style={styles.saveCtaText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    card: { borderRadius: Radius.card, borderWidth: 1, padding: 24 },
    iconWrap: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: 'rgba(45,224,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
      alignSelf: 'center', marginBottom: 20,
    },

    errorBanner: {
      borderRadius: Radius.button, padding: 12, marginBottom: 16,
      backgroundColor: 'rgba(255,92,107,0.12)',
    },
    errorText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: Colors.negative },

    fieldGroup: { gap: 6, marginBottom: 16 },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, letterSpacing: 1.2,
    },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      height: 48, borderRadius: Radius.button, borderWidth: 1.5,
      paddingHorizontal: 16, gap: 8,
    },
    input: {
      flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, height: '100%',
    },

    forgotLinkWrap: { marginBottom: 16, marginTop: -8 },
    forgotLink: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.cyan },
    forgotSentText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: Colors.positive,
      marginBottom: 16, marginTop: -8,
    },

    requirements: { gap: 8, marginBottom: 20, marginTop: 4 },
    requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    requirementDot: {
      width: 16, height: 16, borderRadius: 8,
      borderWidth: 1.5, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    requirementDotMet: { backgroundColor: Colors.positive, borderColor: Colors.positive },
    requirementText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },

    saveCta: {
      height: 52, borderRadius: Radius.button, backgroundColor: Colors.blue,
      alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    saveCtaDisabled: { opacity: 0.5 },
    saveCtaText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.white },

    successIconWrap: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: 'rgba(47,217,139,0.12)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    successTitle: {
      fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle,
      textAlign: 'center', marginBottom: 8,
    },
    successSubtitle: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body,
      textAlign: 'center', marginBottom: 24, paddingHorizontal: 8,
    },
    doneButton: {
      height: 48, paddingHorizontal: 32, borderRadius: Radius.button,
      backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
    },
    doneButtonText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.white },
  }), [theme]);
}
