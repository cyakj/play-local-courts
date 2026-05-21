import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Users } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
  MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type JoinRequest = Database['public']['Tables']['community_join_requests']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface RequestWithProfile extends JoinRequest {
  profile: Profile | null;
}

export default function PendingRequestsScreen() {
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

    // Fetch profiles separately (no FK relationship between community_join_requests and profiles)
    const userIds = rawRequests.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map<string, Profile>();
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p);
    }

    const enriched: RequestWithProfile[] = rawRequests.map((r) => ({
      ...r,
      profile: profileMap.get(r.user_id) ?? null,
    }));

    setRequests(enriched);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();

    const subscription = supabase
      .channel('community_join_requests_admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_join_requests' },
        loadRequests,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRequest(id: string, status: 'approved' | 'rejected') {
    setProcessingId(id);
    await supabase
      .from('community_join_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    setProcessingId(null);
    loadRequests();
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title={`Pending Requests${requests.length > 0 ? ` (${requests.length})` : ''}`}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {!loading && requests.length === 0 && (
            <EmptyState
              icon={<Users color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No pending requests"
              subtitle="All community join requests have been reviewed."
            />
          )}

          {requests.map((req) => {
            const isProcessing = processingId === req.id;
            const displayName = req.profile?.full_name ?? 'Unknown User';
            const username = req.profile?.username;
            const appliedDate = new Date(req.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <Card key={req.id} style={styles.requestCard}>
                {/* Requester info */}
                <View style={styles.requesterRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.requesterInfo}>
                    <Text style={styles.requesterName}>{displayName}</Text>
                    {username ? (
                      <Text style={styles.requesterSub}>@{username}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Application date */}
                <Text style={styles.appliedDate}>Applied {appliedDate}</Text>

                {/* Message */}
                {req.message ? (
                  <Text style={styles.message} numberOfLines={3}>
                    "{req.message}"
                  </Text>
                ) : null}

                {/* Approve / Reject */}
                <View style={styles.actionRow}>
                  <View style={styles.actionBtn}>
                    <Button
                      variant="accent"
                      label="Approve"
                      onPress={() => updateRequest(req.id, 'approved')}
                      loading={isProcessing}
                      disabled={!!processingId && !isProcessing}
                      fullWidth
                    />
                  </View>
                  <View style={styles.actionBtn}>
                    <Button
                      variant="destructive"
                      label="Reject"
                      onPress={() => updateRequest(req.id, 'rejected')}
                      loading={isProcessing}
                      disabled={!!processingId && !isProcessing}
                      fullWidth
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  requestCard: { gap: 12 },
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 18,
    color: Colors.navy,
  },
  requesterInfo: { flex: 1 },
  requesterName: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.textPrimary,
  },
  requesterSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
    marginTop: 2,
  },
  appliedDate: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.min,
    color: Colors.textMuted,
  },
  message: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textSubtle,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBtn: { flex: 1 },
});
