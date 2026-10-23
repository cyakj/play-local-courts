import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, MaxWidth, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { fetchMyInterestRequests, submitCommunityInterest, type InterestRequest } from '@/lib/communityInterest';
import {
  COMMUNITY_TYPES, buildInviteMessage, classifyInterestError, interestStatusDisplay, validateInterestForm,
  type InterestFormErrors, type InterestFormInput, type InterestTone,
} from '@/lib/communityInterestLogic';

const EMPTY: InterestFormInput = { communityName: '', city: '', region: '', communityType: 'hoa', approxUnits: '', contactName: '', contactEmail: '', notes: '' };
const FIELDS: { key: Exclude<keyof InterestFormInput, 'communityType'>; label: string; maxLength: number }[] = [
  { key: 'communityName', label: 'Community name', maxLength: 120 },
  { key: 'city', label: 'City', maxLength: 80 }, { key: 'region', label: 'Region (optional)', maxLength: 80 },
  { key: 'approxUnits', label: 'Approximate units (optional)', maxLength: 6 },
  { key: 'contactName', label: 'Board / manager contact name (optional)', maxLength: 120 },
  { key: 'contactEmail', label: 'Board / manager email (optional)', maxLength: 254 },
  { key: 'notes', label: 'Notes (optional)', maxLength: 1000 },
];
const TONE_COLOR: Record<InterestTone, string> = {
  warning: Colors.volt, info: Colors.cyan, success: Colors.positive, error: Colors.negative, neutral: Colors.textMuted,
};

export default function CommunityInterestScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [form, setForm] = useState<InterestFormInput>(EMPTY);
  const [errors, setErrors] = useState<InterestFormErrors>({});
  const [requests, setRequests] = useState<InterestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [submittedName, setSubmittedName] = useState('');
  const loadSequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSequence.current;
    setLoading(true);
    setListError('');
    try {
      const rows = await fetchMyInterestRequests();
      if (seq === loadSequence.current) setRequests(rows);
    } catch (e) {
      if (seq === loadSequence.current) setListError(classifyInterestError(e));
    } finally {
      if (seq === loadSequence.current) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { ++loadSequence.current; }; }, [load]));

  async function share(communityName: string) {
    try { await Share.share({ message: buildInviteMessage({ communityName }) }); }
    catch { setActionError('Could not open sharing. Please try again.'); }
  }
  async function submit() {
    if (submitting.current) return;
    const nextErrors = validateInterestForm(form);
    setErrors(nextErrors);
    setActionError('');
    if (Object.keys(nextErrors).length) return;
    submitting.current = true;
    setBusy(true);
    try {
      await submitCommunityInterest(form);
      setSubmittedName(form.communityName.trim());
      setForm(EMPTY);
      await load();
    } catch (e) { setActionError(classifyInterestError(e)); }
    finally { submitting.current = false; setBusy(false); }
  }
  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Tell us about your community" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Text style={styles.body}>Let us know where you live so our team can reach out. This request does not register a community or grant access.</Text>
          {!!actionError && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
          {submittedName ? <View style={styles.card}>
            <Text style={styles.title}>Thanks for telling us about {submittedName}</Text>
            <Text style={styles.body}>You can follow the status below and invite your board or property manager.</Text>
            <Button label="Share invitation" onPress={() => share(submittedName)} fullWidth />
            <Button variant="ghost" label="Back to search" onPress={() => router.replace('/join-community')} fullWidth />
            <Button variant="ghost" label="Tell us about another community" onPress={() => setSubmittedName('')} fullWidth />
          </View> : <View style={styles.card}>
            {FIELDS.map(({ key, label, maxLength }) => <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput accessibilityLabel={label} style={[styles.input, key === 'notes' && styles.multiline]}
                value={form[key]} editable={!busy} maxLength={maxLength} multiline={key === 'notes'}
                keyboardType={key === 'contactEmail' ? 'email-address' : key === 'approxUnits' ? 'number-pad' : 'default'}
                autoCapitalize={key === 'contactEmail' ? 'none' : 'sentences'}
                onChangeText={(value) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: undefined })); }} />
              {!!errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
            </View>)}
            <Text style={styles.label}>Community type</Text>
            <View style={styles.chips}>{COMMUNITY_TYPES.map((t) => <TouchableOpacity key={t.value}
              accessibilityRole="button" accessibilityState={{ selected: form.communityType === t.value, disabled: busy }}
              disabled={busy} style={[styles.chip, form.communityType === t.value && styles.selected]}
              onPress={() => setForm((prev) => ({ ...prev, communityType: t.value }))}>
              <Text style={styles.body}>{t.label}</Text>
            </TouchableOpacity>)}</View>
            {!!errors.communityType && <Text style={styles.error}>{errors.communityType}</Text>}
            <Button label={busy ? 'Sending…' : 'Submit interest'} onPress={submit} loading={busy} disabled={busy} fullWidth />
          </View>}
          <Text style={styles.section}>Your requests</Text>
          {loading ? <ActivityIndicator color={Colors.cyan} /> : listError ? <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.error}>{listError}</Text>
            <Button variant="ghost" label="Retry" onPress={load} fullWidth />
          </View> : requests.length === 0 ? <Text style={styles.body}>You haven't submitted any community interest yet.</Text> : requests.map((request) => {
            const display = interestStatusDisplay(request.status);
            return <View key={request.id} style={styles.card}>
              <Text style={styles.title}>{request.community_name}</Text>
              <Text style={styles.body}>{[request.city, request.region].filter(Boolean).join(', ')}</Text>
              <View style={[styles.pill, { borderColor: TONE_COLOR[display.tone] }]}>
                <Text style={[styles.pillText, { color: TONE_COLOR[display.tone] }]}>{display.label.toUpperCase()}</Text>
              </View>
              {!!request.status_message && <Text style={styles.body}>{request.status_message}</Text>}
              <Button variant="ghost" label={`Share invitation for ${request.community_name}`} onPress={() => share(request.community_name)} fullWidth />
            </View>;
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg }, content: { padding: 20, paddingBottom: 48 },
    inner: { width: '100%', maxWidth: MaxWidth, alignSelf: 'center', gap: 24 },
    card: { padding: 20, gap: 16, backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1, borderColor: theme.border, ...theme.shadowCard },
    title: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: theme.textPrimary },
    section: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, color: theme.textPrimary },
    body: { fontFamily: FontFamily.manropeMedium, fontSize: 16, lineHeight: 24, color: theme.textSecondary },
    label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: theme.textPrimary },
    error: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: Colors.negative },
    field: { gap: 8 }, input: { minHeight: 48, borderRadius: Radius.input, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.inputBg, padding: 12, color: theme.textPrimary, fontSize: 16, fontFamily: FontFamily.manropeMedium },
    multiline: { minHeight: 100, textAlignVertical: 'top' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border },
    selected: { borderColor: Colors.cyan }, pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    pillText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12 },
  }), [theme]);
}
