import { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import type { LessonRequest } from '@/hooks/useLessonRequests';

type StatusVariant = 'pending' | 'confirmed' | 'completed' | 'declined' | 'expired' | 'no-show' | 'coach-cancelled' | 'approved';

const STATUS_PILL_MAP: Record<string, StatusVariant> = {
  pending:         'pending',
  approved:        'approved',
  confirmed:       'confirmed',
  completed:       'completed',
  declined:        'declined',
  cancelled:       'declined',
  coach_cancelled: 'coach-cancelled',
  no_show:         'no-show',
  expired:         'expired',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  pending:         'PENDING',
  approved:        'APPROVED',
  confirmed:       'CONFIRMED',
  completed:       'COMPLETED',
  declined:        'DECLINED',
  cancelled:       'CANCELLED',
  coach_cancelled: 'COACH CANCELLED',
  no_show:         'NO SHOW',
  expired:         'EXPIRED',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner:         'Beginner',
  intermediate:     'Intermediate',
  high_performance: 'High Perf',
};

interface Props {
  request: LessonRequest;
  onRefresh: () => void;
  onLeaveReview?: () => void;
}

export function LessonRequestRow({ request, onRefresh, onLeaveReview }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [cancelling, setCancelling] = useState(false);

  const initials = (request.coachName ?? 'C')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const displayDate = useMemo(() => {
    const dateStr = request.confirmedDate ?? request.preferredDate;
    if (!dateStr) return null;
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }, [request.confirmedDate, request.preferredDate]);

  const timeDisplay = useMemo(() => {
    if (request.confirmedTimeStart && request.confirmedTimeEnd) {
      return `${fmtTime(request.confirmedTimeStart)} – ${fmtTime(request.confirmedTimeEnd)}`;
    }
    return `~${fmtTime(request.preferredTimeStart)} (preferred)`;
  }, [request.confirmedTimeStart, request.confirmedTimeEnd, request.preferredTimeStart, request.preferredTimeEnd]);

  const expiresIn = useMemo(() => {
    if (!request.expiresAt) return null;
    const ms = new Date(request.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    if (h < 1) return '< 1h left';
    if (h < 24) return `${h}h left`;
    return `${Math.floor(h/24)}d left`;
  }, [request.expiresAt]);

  const pillVariant: StatusVariant = STATUS_PILL_MAP[request.status] ?? 'pending';
  const pillLabel = STATUS_LABEL_MAP[request.status] ?? request.status.toUpperCase();

  const isReviewEligible =
    request.status === 'completed' &&
    request.attendanceStatus === 'attended' &&
    request.reviewEligibleAt != null &&
    new Date(request.reviewEligibleAt) <= new Date();

  async function handleCancel() {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this lesson request?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            await supabase
              .from('lesson_requests')
              .update({ status: 'cancelled', cancelled_by: 'player' })
              .eq('id', request.id);
            setCancelling(false);
            onRefresh();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.row}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {request.coachAvatarUrl ? (
          <Image source={{ uri: request.coachAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.coachName} numberOfLines={1}>
            {request.coachName ?? 'Coach'}
          </Text>
          <StatusPill variant={pillVariant} label={pillLabel} />
        </View>

        <Text style={styles.lessonMeta}>
          {request.lessonType}
          {request.durationMinutes ? ` · ${request.durationMinutes} min` : ''}
          {request.skillLevel ? ` · ${LEVEL_LABELS[request.skillLevel] ?? request.skillLevel}` : ''}
        </Text>

        {displayDate && (
          <Text style={styles.dateTime}>{displayDate} · {timeDisplay}</Text>
        )}

        {request.location && (
          <Text style={styles.location} numberOfLines={1}>{request.location}</Text>
        )}

        {/* Expiry countdown for pending */}
        {request.status === 'pending' && expiresIn && (
          <Text style={styles.expiryTxt}>Expires: {expiresIn}</Text>
        )}

        {/* Action row */}
        <View style={styles.actionRow}>
          {/* Message */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/messages', params: { recipientId: request.coachId } } as any)}
            activeOpacity={0.8}
          >
            <MessageCircle size={14} strokeWidth={2} color={theme.textSecondary} />
            <Text style={styles.actionBtnLabel}>Message</Text>
          </TouchableOpacity>

          {/* Cancel (only for pending) */}
          {request.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnLabel}>{cancelling ? 'Cancelling…' : 'Cancel'}</Text>
            </TouchableOpacity>
          )}

          {/* Leave Review */}
          {isReviewEligible && onLeaveReview && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.reviewBtn]}
              onPress={onLeaveReview}
              activeOpacity={0.8}
            >
              <Text style={styles.reviewBtnLabel}>Leave Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`;
}

export function LessonRequestRowSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      gap: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
    }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.border }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '60%', height: 14, backgroundColor: theme.border, borderRadius: 4 }} />
        <View style={{ width: '80%', height: 12, backgroundColor: theme.border, borderRadius: 4 }} />
        <View style={{ width: '40%', height: 12, backgroundColor: theme.border, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
    },
    avatarWrap: { flexShrink: 0 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: {
      backgroundColor: 'rgba(45,107,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 15,
      color: Colors.cyan,
    },
    content: { flex: 1, gap: 4 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    coachName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      flex: 1,
      letterSpacing: -0.2,
    },
    lessonMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    dateTime: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    location: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    expiryTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: Colors.volt,
      letterSpacing: 0.4,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.xs,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    cancelBtn: {
      borderColor: 'rgba(255,92,107,0.30)',
    },
    cancelBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    reviewBtn: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.35)',
    },
    reviewBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
  }), [theme]);
}
