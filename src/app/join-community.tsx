import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Building2, Search } from 'lucide-react-native';

import { useSession } from '@/context/NativeAuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { refreshActiveCommunity, setActiveCommunity } from '@/hooks/useActiveCommunity';
import {
  fetchMyMemberships, requestToJoin, searchCommunities, withdrawRequest, type MyMembershipRow,
} from '@/lib/communityJoin';
import {
  SEARCH_MIN_CHARS, canRequestToJoin, classifyJoinError, joinErrorMessage, membershipDisplay, sanitizeSearchTerm,
  type CommunityResult, type StatusTone,
} from '@/lib/communityJoinLogic';
import { errorMessage } from '@/lib/errors';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

const TONE_COLOR: Record<StatusTone, string> = {
  pending: Colors.volt,
  approved: Colors.positive,
  rejected: Colors.negative,
  unknown: Colors.textMuted,
};

export default function JoinCommunityScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [mine, setMine] = useState<MyMembershipRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [mineError, setMineError] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [busyHoa, setBusyHoa] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const searchSeq = useRef(0);

  const loadMine = useCallback(async () => {
    if (!userId) return;
    setMineError('');
    try {
      setMine(await fetchMyMemberships(userId));
    } catch (e) {
      setMineError(errorMessage(e, 'Could not load your requests.'));
    } finally {
      setLoadingMine(false);
    }
  }, [userId]);

  // Re-read on focus so an approval made by the admin while the app was open is observed.
  useFocusEffect(useCallback(() => { loadMine(); }, [loadMine]));

  const runSearch = useCallback(async (raw: string, current: MyMembershipRow[]) => {
    const seq = ++searchSeq.current;
    if (!sanitizeSearchTerm(raw).valid) { setResults([]); setSearching(false); setSearchError(''); return; }
    setSearching(true);
    setSearchError('');
    try {
      const found = await searchCommunities(raw, current);
      if (seq === searchSeq.current) setResults(found); // ignore out-of-order responses
    } catch (e) {
      if (seq === searchSeq.current) setSearchError(errorMessage(e, 'Search failed.'));
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { runSearch(query, mine); }, 300);
    return () => clearTimeout(t);
  }, [query, mine, runSearch]);

  async function handleRequest(c: CommunityResult) {
    if (busyHoa || !canRequestToJoin(c.myStatus)) return; // duplicate-submit guard
    setBusyHoa(c.id);
    setActionError('');
    try {
      await requestToJoin(c.id);
    } catch (e) {
      const kind = classifyJoinError(e);
      // Already requested elsewhere (second device / stale list): not an error, just show the real status.
      if (kind !== 'already_requested') setActionError(joinErrorMessage(kind));
    } finally {
      await loadMine();
      setBusyHoa(null);
    }
  }

  async function handleWithdraw(m: MyMembershipRow) {
    if (busyHoa) return;
    setBusyHoa(m.hoaId);
    setActionError('');
    try {
      await withdrawRequest(m.hoaId);
    } catch (e) {
      setActionError(errorMessage(e, 'Could not withdraw the request.'));
    } finally {
      await loadMine();
      setBusyHoa(null);
    }
  }

  async function handleOpen(m: MyMembershipRow) {
    if (busyHoa) return;
    setBusyHoa(m.hoaId);
    setActionError('');
    let opened = false;
    try {
      // The shared community store may hold an empty list from before approval: refresh, then select, then go.
      // The store swallows load failures, so a false result here is the signal that the refresh did not take.
      await refreshActiveCommunity();
      opened = await setActiveCommunity(m.hoaId);
      if (!opened) setActionError('Could not open your community. Check your connection and try again.');
    } catch (e) {
      setActionError(errorMessage(e, 'Could not open your community. Please try again.'));
    } finally {
      setBusyHoa(null);
    }
    if (opened) router.replace('/(resident)');
  }

  const typedEnough = sanitizeSearchTerm(query).valid;

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Join a community" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {!!actionError && <Text testID="join-action-error" style={styles.error}>{actionError}</Text>}

          <Text style={styles.eyebrow}>YOUR REQUESTS</Text>
          {loadingMine ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 16 }} />
          ) : mineError ? (
            <View style={styles.card}>
              <Text style={styles.error}>{mineError}</Text>
              <Button variant="ghost" label="Retry" onPress={() => { setLoadingMine(true); loadMine(); }} fullWidth />
            </View>
          ) : mine.length === 0 ? (
            <Text testID="join-no-requests" style={styles.muted}>You haven't requested to join a community yet.</Text>
          ) : (
            mine.map((m) => {
              const d = membershipDisplay(m.status);
              const busy = busyHoa === m.hoaId;
              return (
                <View key={m.id} testID={`membership-${m.hoaId}`} style={styles.card}>
                  <View style={styles.row}>
                    <Building2 color={theme.textSecondary} size={22} strokeWidth={1.5} />
                    <Text style={styles.cardTitle} numberOfLines={2}>{m.hoaName}</Text>
                  </View>
                  <View style={[styles.pill, { borderColor: TONE_COLOR[d.tone] }]}>
                    <Text style={[styles.pillText, { color: TONE_COLOR[d.tone] }]}>{d.label.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.muted}>{d.description}</Text>
                  {d.tone === 'pending' && (
                    <Button variant="ghost" label={busy ? 'Withdrawing…' : 'Withdraw request'} onPress={() => handleWithdraw(m)} disabled={!!busyHoa} fullWidth />
                  )}
                  {d.tone === 'approved' && (
                    <Button variant="primary" label="Open community" onPress={() => handleOpen(m)} loading={busy} disabled={!!busyHoa} fullWidth />
                  )}
                </View>
              );
            })
          )}

          <Text style={[styles.eyebrow, { marginTop: 24 }]}>FIND YOUR COMMUNITY</Text>
          <View style={styles.searchWrap}>
            <Search color={theme.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              testID="community-search"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by community name"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {!typedEnough ? (
            <Text style={styles.muted}>Type at least {SEARCH_MIN_CHARS} characters to search approved communities.</Text>
          ) : searching ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 16 }} />
          ) : searchError ? (
            <View style={styles.card}>
              <Text style={styles.error}>{searchError}</Text>
              <Button variant="ghost" label="Retry search" onPress={() => runSearch(query, mine)} fullWidth />
            </View>
          ) : results.length === 0 ? (
            <View testID="community-search-empty" style={styles.card}>
              <Text style={styles.cardTitle}>No communities found</Text>
              <Text style={styles.muted}>
                Only communities already approved on TenisX appear here. Check the spelling, or ask your HOA to register with TenisX.
              </Text>
            </View>
          ) : (
            results.map((c) => {
              const d = c.myStatus ? membershipDisplay(c.myStatus) : null;
              return (
                <View key={c.id} testID={`community-result-${c.id}`} style={styles.card}>
                  <View style={styles.row}>
                    <Building2 color={theme.textSecondary} size={22} strokeWidth={1.5} />
                    <Text style={styles.cardTitle} numberOfLines={2}>{c.name}</Text>
                  </View>
                  {d ? (
                    <View style={[styles.pill, { borderColor: TONE_COLOR[d.tone] }]}>
                      <Text style={[styles.pillText, { color: TONE_COLOR[d.tone] }]}>{d.label.toUpperCase()}</Text>
                    </View>
                  ) : (
                    <Button
                      variant="primary"
                      label={busyHoa === c.id ? 'Sending…' : 'Request to join'}
                      onPress={() => handleRequest(c)}
                      loading={busyHoa === c.id}
                      disabled={!!busyHoa}
                      fullWidth
                    />
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 48 },
    inner: { width: '100%', maxWidth: MaxWidth, alignSelf: 'center', gap: 12 },
    eyebrow: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 2, color: theme.textMuted },
    card: {
      gap: 12, padding: 20, backgroundColor: theme.cardBg, borderRadius: Radius.card,
      borderWidth: 1, borderColor: theme.border, ...theme.shadowCard,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardTitle: { flex: 1, fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: theme.textPrimary },
    muted: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textSecondary, lineHeight: 22 },
    error: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: Colors.negative },
    pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
    pillText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, letterSpacing: 1 },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16,
      borderWidth: 1, borderColor: theme.border, borderRadius: Radius.input, backgroundColor: theme.inputBg,
    },
    searchInput: { flex: 1, fontSize: 16, fontFamily: FontFamily.manropeMedium, color: theme.textPrimary },
  }), [theme]);
}
