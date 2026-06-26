import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { UserCheck, UserX, Users } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';

type JoinRequest = Database['public']['Tables']['community_join_requests']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface RequestWithProfile extends JoinRequest {
  profile: Profile | null;
}

export default function PendingRequestsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    const { data: rawRequests } = await supabase
      .from('community_join_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!rawRequests || rawRequests.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const userIds = rawRequests.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map<string, Profile>();
    for (const p of profiles ?? []) profileMap.set(p.id, p);

    const enriched: RequestWithProfile[] = rawRequests.map((r) => ({
      ...r,
      profile: profileMap.get(r.user_id) ?? null,
    }));

    setRequests(enriched);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();

    const sub = supabase
      .channel('community_join_requests_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_join_requests' }, loadRequests)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  async function updateRequest(req: RequestWithProfile, action: 'approved' | 'rejected') {
    setProcessingId(req.id);
    setActionError(null);

    // Look up the hoa_memberships row for this user+hoa (created by request_hoa_membership())
    const { data: membership } = await supabase
      .from('hoa_memberships')
      .select('id')
      .eq('user_id', req.user_id)
      .eq('hoa_id', req.hoa_id)
      .eq('status', 'pending')
      .single();

    let finalError: string | null = null;

    if (membership) {
      // Prefer the RPC functions which run as SECURITY DEFINER and handle both tables
      const fnName = action === 'approved' ? 'approve_hoa_membership' : 'reject_hoa_membership';
      const { error: rpcError } = await supabase.rpc(fnName, { membership_id: membership.id });
      if (rpcError) {
        // RPC failed (e.g. caller not admin in hoa_memberships); do direct updates as fallback
        const [memRes, jrRes] = await Promise.all([
          supabase.from('hoa_memberships').update({ status: action, updated_at: new Date().toISOString() }).eq('id', membership.id),
          supabase.from('community_join_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', req.id),
        ]);
        if (memRes.error || jrRes.error) {
          finalError = memRes.error?.message ?? jrRes.error?.message ?? 'Unknown error';
        }
      }
    } else {
      // Fallback: no hoa_memberships row found — update community_join_requests only
      const { error } = await supabase
        .from('community_join_requests')
        .update({ status: action, updated_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) finalError = error.message;
    }

    setProcessingId(null);
    if (finalError) {
      setActionError(finalError);
    } else {
      loadRequests();
    }
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Pending Requests" onBack={() => router.back()} />

      {/* Hero section */}
      <View style={styles.hero}>
        <Text style={styles.heroTag}>ADMIN</Text>
        <Text style={styles.heroTitle}>Pending Requests</Text>
        <Text style={styles.heroSub}>Review and approve users wanting to join your HOA.</Text>
        {requests.length > 0 && (
          <View style={styles.awaitingBadge}>
            <Users color={Colors.white} size={12} strokeWidth={1.5} />
            <Text style={styles.awaitingText}>{requests.length} Awaiting</Text>
          </View>
        )}
      </View>

      {actionError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{actionError}</Text>
          <TouchableOpacity onPress={() => setActionError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.errorBannerDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {!loading && requests.length === 0 && (
            <View style={styles.emptyCard}>
              <UserCheck color={Colors.accentCyan} size={48} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>All Clear</Text>
              <Text style={styles.emptySub}>No pending member requests right now.</Text>
            </View>
          )}

          {requests.map((req) => {
            const isProcessing = processingId === req.id;
            const displayName = req.profile?.full_name ?? 'Unknown User';
            const appliedDate = new Date(req.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });

            return (
              <View key={req.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{displayName}</Text>
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>Pending</Text>
                  </View>
                </View>

                <View style={styles.detailRows}>
                  {(req.profile as any)?.email && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>EMAIL</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{(req.profile as any).email}</Text>
                    </View>
                  )}
                  {(req.profile as any)?.phone_number && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>PHONE</Text>
                      <Text style={styles.detailValue}>{(req.profile as any).phone_number}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>APPLIED</Text>
                    <Text style={styles.detailValue}>{appliedDate}</Text>
                  </View>
                </View>

                {req.message ? (
                  <Text style={styles.message} numberOfLines={3}>"{req.message}"</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => updateRequest(req, 'rejected')}
                    disabled={!!processingId}
                    activeOpacity={0.8}>
                    <UserX color={Colors.negative} size={16} strokeWidth={1.5} />
                    <Text style={styles.rejectLabel}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => updateRequest(req, 'approved')}
                    disabled={!!processingId}
                    activeOpacity={0.8}>
                    <UserCheck color={Colors.white} size={16} strokeWidth={1.5} />
                    <Text style={styles.approveLabel}>{isProcessing ? 'Processing…' : 'Approve'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },

    hero: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 8,
      paddingBottom: 20,
    },
    heroTag: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: Colors.accentCyan,
      letterSpacing: 2,
      marginBottom: 6,
    },
    heroTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.display,
      color: theme.textPrimary,
      letterSpacing: -0.8,
      lineHeight: 42,
    },
    heroSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      marginTop: 6,
      lineHeight: 22,
    },
    awaitingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,92,107,0.18)',
      borderRadius: Radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: 'flex-start',
      marginTop: 12,
    },
    awaitingText: { fontFamily: FontFamily.manropeExtraBold, fontSize: 12, color: Colors.negative },

    content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },

    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255,92,107,0.12)',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 10,
      gap: 12,
    },
    errorBannerText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
      flex: 1,
    },
    errorBannerDismiss: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 14,
      color: Colors.negative,
    },

    emptyCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 40,
      alignItems: 'center',
      gap: 8,
      ...theme.shadowCard,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 15, color: theme.textPrimary },
    emptySub: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textMuted, textAlign: 'center' },

    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 20,
      ...theme.shadowCard,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardName: { fontFamily: FontFamily.manropeExtraBold, fontSize: 16, color: theme.textPrimary, flex: 1 },
    pendingPill: {
      backgroundColor: 'rgba(255,92,107,0.12)',
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.35)',
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    pendingPillText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: Colors.negative,
    },

    detailRows: { gap: 6 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    detailLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: theme.textMuted,
      letterSpacing: 0.8,
      width: 64,
      flexShrink: 0,
    },
    detailValue: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textPrimary, flex: 1 },

    message: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      fontStyle: 'italic',
      lineHeight: 20,
    },

    actionRow: { flexDirection: 'row', gap: 10 },
    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,92,107,0.10)',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      paddingVertical: 13,
      minHeight: 44,
    },
    rejectLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: Colors.negative },
    approveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: Colors.accentCyan,
      borderRadius: Radius.button,
      paddingVertical: 13,
      minHeight: 44,
    },
    approveLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: Colors.navy },
  }), [theme]);
}
