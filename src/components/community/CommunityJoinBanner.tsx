import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Building2 } from 'lucide-react-native';

import { useActiveCommunity } from '@/hooks/useActiveCommunity';
import { useSession } from '@/context/NativeAuthContext';
import { useTheme } from '@/context/ThemeContext';
import { fetchMyMemberships } from '@/lib/communityJoin';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

/**
 * Resident home prompt: "Find your community" (no approved community) or "Request pending" (any pending request).
 * Renders nothing for members with no pending request, and never reads private community data.
 */
export function CommunityJoinBanner() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { session } = useSession();
  const { communities, loading } = useActiveCommunity();
  const [pendingCount, setPendingCount] = useState(0);
  const userId = session?.user?.id ?? null;

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let live = true;
    fetchMyMemberships(userId)
      .then((rows) => { if (live) setPendingCount(rows.filter((r) => r.status === 'pending').length); })
      .catch(() => { /* banner is advisory; the join screen shows real errors */ });
    return () => { live = false; };
  }, [userId]));

  // Hide only for members with nothing pending; a pending request must stay reachable even for existing members.
  if (loading || (communities.length > 0 && pendingCount === 0)) return null;

  return (
    <TouchableOpacity
      testID="community-join-banner"
      style={styles.card}
      onPress={() => router.push('/join-community' as never)}
      activeOpacity={0.8}>
      <Building2 color={Colors.cyan} size={24} strokeWidth={1.5} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{pendingCount > 0 ? 'Request pending approval' : 'Find your community'}</Text>
        <Text style={styles.body}>
          {pendingCount > 0
            ? 'Your community admin still has to approve your request. Check its status.'
            : 'Search for your HOA and request to join to unlock reservations and updates.'}
        </Text>
      </View>
      <ChevronRight color={theme.textMuted} size={20} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20,
      backgroundColor: theme.cardBg, borderRadius: Radius.card,
      borderWidth: 1, borderColor: theme.border, marginBottom: 24,
    },
    title: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: theme.textPrimary },
    body: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.uiLabel, color: theme.textSecondary, marginTop: 4, lineHeight: 20 },
  }), [theme]);
}
