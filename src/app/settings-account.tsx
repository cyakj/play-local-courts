import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { ChevronRight, FileText, LogOut, Mail, Phone, ShieldCheck, Trash2 } from 'lucide-react-native';

import { useSession } from '@/context/NativeAuthContext';
import { supabase } from '@/lib/supabase';
import { confirmAndSignOut } from '@/lib/authActions';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { Header } from '@/components/ui/Header';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { openSupportEmail } from '@/lib/support';
import {
  DELETION_NOTICE, EMAIL_CHANGE_NOTICE, PHONE_NOTICE, checkNewEmail, checkPhone,
} from '@/lib/accountSettings';

export default function SettingsAccountScreen() {
  const { session, loading } = useSession();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [phone, setPhone] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState('');
  // Inline editors: only one open at a time
  const [editing, setEditing] = useState<'email' | 'phone' | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

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

  function openEditor(kind: 'email' | 'phone') {
    setMsg(null);
    setEditing(kind);
    setDraft(kind === 'phone' ? (phone ?? '') : '');
  }

  async function saveEmail() {
    const check = checkNewEmail(draft, session?.user.email);
    if (!check.ok) { setMsg({ tone: 'error', text: check.message }); return; }
    setBusy(true);
    // Reuses Supabase Auth: it emails confirmation links and only switches the address after confirmation.
    const { error } = await supabase.auth.updateUser({ email: check.email });
    setBusy(false);
    if (error) { setMsg({ tone: 'error', text: error.message }); return; }
    setEditing(null);
    setMsg({ tone: 'ok', text: EMAIL_CHANGE_NOTICE });
  }

  async function savePhone() {
    const check = checkPhone(draft);
    if (!check.ok) { setMsg({ tone: 'error', text: check.message }); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ phone_number: check.phone }).eq('id', session!.user.id);
    setBusy(false);
    if (error) { setMsg({ tone: 'error', text: 'Could not save your phone number. Please try again.' }); return; }
    setPhone(check.phone);
    setEditing(null);
    setMsg({ tone: 'ok', text: check.phone ? 'Phone number saved.' : 'Phone number removed.' });
  }

  const email = session.user.email ?? '—';

  function confirmSignOut() {
    setSignOutError('');
    confirmAndSignOut(setSignOutError);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="Account" onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/settings' as any); }} />

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
              <TouchableOpacity testID="account-email-change" onPress={() => openEditor('email')} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.editLink, { color: Colors.blue }]}>Change</Text>
              </TouchableOpacity>
            </View>
            {editing === 'email' && (
              <View style={styles.editor}>
                <TextInput
                  testID="account-email-input"
                  style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.surface2, borderColor: theme.border }]}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="new@email.com"
                  placeholderTextColor={Colors.textPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!busy}
                />
                <View style={styles.editorBtns}>
                  <TouchableOpacity testID="account-email-save" style={styles.primaryBtn} onPress={saveEmail} disabled={busy} accessibilityRole="button">
                    {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryBtnText}>Send confirmation</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditing(null); setMsg(null); }} disabled={busy} accessibilityRole="button">
                    <Text style={[styles.editLink, { color: theme.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
              <TouchableOpacity testID="account-phone-change" onPress={() => openEditor('phone')} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.editLink, { color: Colors.blue }]}>{phone ? 'Change' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
            {editing === 'phone' && (
              <View style={styles.editor}>
                <TextInput
                  testID="account-phone-input"
                  style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.surface2, borderColor: theme.border }]}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="phone-pad"
                  editable={!busy}
                />
                <Text style={[styles.actionDesc, { color: theme.textMuted }]}>{PHONE_NOTICE}</Text>
                <View style={styles.editorBtns}>
                  <TouchableOpacity testID="account-phone-save" style={styles.primaryBtn} onPress={savePhone} disabled={busy} accessibilityRole="button">
                    {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditing(null); setMsg(null); }} disabled={busy} accessibilityRole="button">
                    <Text style={[styles.editLink, { color: theme.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Security */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>SECURITY</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.actionRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => router.push('/settings-change-password' as any)}
              activeOpacity={0.7}>
              <View>
                <Text style={[styles.actionLabel, { color: Colors.blue }]}>Change Password</Text>
                <Text style={[styles.actionDesc, { color: theme.textMuted }]}>
                  Update your password from within the app
                </Text>
              </View>
              <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {msg && (
            <Text testID="account-message" style={[styles.msg, { color: msg.tone === 'ok' ? Colors.positive : Colors.negative }]}>{msg.text}</Text>
          )}

          {/* Policies */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>LEGAL</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity testID="account-privacy-link" style={[styles.actionRow, styles.linkRowFlex]} onPress={() => router.push('/legal/privacy' as any)} activeOpacity={0.7} accessibilityRole="button">
              <ShieldCheck color={theme.textMuted} size={18} strokeWidth={1.5} />
              <Text style={[styles.actionLabel, { color: theme.textPrimary, flex: 1 }]}>Privacy Policy</Text>
              <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <TouchableOpacity testID="account-terms-link" style={[styles.actionRow, styles.linkRowFlex]} onPress={() => router.push('/legal/terms' as any)} activeOpacity={0.7} accessibilityRole="button">
              <FileText color={theme.textMuted} size={18} strokeWidth={1.5} />
              <Text style={[styles.actionLabel, { color: theme.textPrimary, flex: 1 }]}>Terms of Service</Text>
              <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Deletion is a REQUEST, never an in-app destructive action (reservation history, HOA membership and audit
              records must be reviewed first). */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>DELETE ACCOUNT</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity testID="account-delete-request" style={[styles.actionRow, styles.linkRowFlex]} onPress={() => { void openSupportEmail('Account deletion request'); }} activeOpacity={0.7} accessibilityRole="button">
              <Trash2 color={Colors.negative} size={18} strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionLabel, { color: Colors.negative }]}>Request account deletion</Text>
                <Text style={[styles.actionDesc, { color: theme.textMuted }]}>{DELETION_NOTICE}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          {!!signOutError && (
            <View style={styles.signOutErrorBanner}>
              <Text style={styles.signOutErrorText}>Sign out failed: {signOutError}</Text>
            </View>
          )}
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

    editLink: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
    editor: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
    editorBtns: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    input: {
      minHeight: 48, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 14,
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body,
    },
    primaryBtn: {
      minHeight: 44, paddingHorizontal: 18, borderRadius: Radius.sm, backgroundColor: Colors.blue,
      alignItems: 'center', justifyContent: 'center',
    },
    primaryBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },
    msg: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 14, lineHeight: 20 },
    linkRowFlex: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    signOutCard: {
      marginTop: 28, borderRadius: Radius.card, paddingVertical: 18,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1, borderColor: 'rgba(255,92,107,0.22)',
      backgroundColor: 'rgba(255,92,107,0.08)',
    },
    signOutText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.negative },
    signOutErrorBanner: {
      marginTop: 28, borderRadius: Radius.card, padding: 12,
      backgroundColor: 'rgba(255,92,107,0.12)',
    },
    signOutErrorText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: Colors.negative, textAlign: 'center',
    },
  }), [theme]);
}
