import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, Clock, MapPin, CheckCircle } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachLessonRequest } from '@/hooks/useCoachRequests';
import { CoachMarkCompleteSheet } from './CoachMarkCompleteSheet';

type StatusVariant = 'pending' | 'confirmed' | 'completed' | 'declined' | 'expired' | 'no-show' | 'coach-cancelled' | 'approved';

const STATUS_PILL_MAP: Record<string, StatusVariant> = {
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
  approved:        'APPROVED',
  confirmed:       'CONFIRMED',
  completed:       'COMPLETED',
  declined:        'DECLINED',
  cancelled:       'CANCELLED',
  coach_cancelled: 'COACH CANCELLED',
  no_show:         'NO SHOW',
  expired:         'EXPIRED',
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  private_lesson:      'Private Lesson',
  semi_private_lesson: 'Semi-Private',
  group_clinic:        'Group Clinic',
  practice_session:    'Practice Session',
  private:             'Private Lesson',
  'semi-private':      'Semi-Private',
  group:               'Group Clinic',
};

interface Props {
  request: CoachLessonRequest;
  showActions?: boolean;
  onMarkComplete: (id: string) => Promise<void>;
  onMarkNoShow: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

export function CoachLessonCard({ request, showActions = true, onMarkComplete, onMarkNoShow, onCancel }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [showAttendance, setShowAttendance] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const displayDate = useMemo(() => {
    const d = request.confirmedDate ?? request.preferredDate;
    if (!d) return null;
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }, [request.confirmedDate, request.preferredDate]);

  const timeDisplay = useMemo(() => {
    if (request.confirmedTimeStart && request.confirmedTimeEnd) {
      return `${fmtTime(request.confirmedTimeStart)} – ${fmtTime(request.confirmedTimeEnd)}`;
    }
    return `${fmtTime(request.preferredTimeStart)} – ${fmtTime(request.preferredTimeEnd)}`;
  }, [request.confirmedTimeStart, request.confirmedTimeEnd, request.preferredTimeStart, request.preferredTimeEnd]);

  const isUpcoming = ['approved', 'confirmed'].includes(request.status);

  const isAfterLesson = useMemo(() => {
    if (!isUpcoming) return false;
    const endTime = request.confirmedTimeEnd ?? request.preferredTimeEnd;
    const dateStr = request.confirmedDate ?? request.preferredDate;
    if (!dateStr || !endTime) return false;
    const [h, m] = endTime.split(':').map(Number);
    const end = new Date(dateStr + 'T00:00:00');
    end.setHours(h, m, 0, 0);
    return new Date() >= end;
  }, [isUpcoming, request.confirmedDate, request.preferredDate, request.confirmedTimeEnd, request.preferredTimeEnd]);

  const pillVariant: StatusVariant = STATUS_PILL_MAP[request.status] ?? 'confirmed';
  const pillLabel  = STATUS_LABEL_MAP[request.status] ?? request.status.toUpperCase();

  const initials = (request.playerName ?? 'P')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  async function handleCancel() {
    Alert.alert(
      'Cancel Lesson',
      `Cancel lesson with ${request.playerName ?? 'this player'}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Lesson',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            await onCancel(request.id);
            setCancelling(false);
          },
        },
      ],
    );
  }

  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>
              {request.playerName ?? 'Player'}
            </Text>
            <Text style={styles.lessonMeta}>
              {LESSON_TYPE_LABELS[request.lessonType] ?? request.lessonType}
              {request.durationMinutes ? ` · ${request.durationMinutes} min` : ''}
            </Text>
          </View>
          <StatusPill status={pillVariant} label={pillLabel} />
        </View>

        {/* Date + time */}
        {displayDate && (
          <View style={styles.infoRow}>
            <Clock size={13} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={styles.infoText}>{displayDate} · {timeDisplay}</Text>
          </View>
        )}

        {/* Location */}
        {(request.facilityName || request.locationPreference) && (
          <View style={styles.infoRow}>
            <MapPin size={13} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={styles.infoText} numberOfLines={1}>
              {request.facilityName ?? request.locationPreference}
            </Text>
          </View>
        )}

        {/* Actions for upcoming */}
        {showActions && isUpcoming && (
          <View style={styles.actionRow}>
            {isAfterLesson && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => setShowAttendance(true)}
                activeOpacity={0.85}>
                <CheckCircle size={14} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.completeBtnText}>Mark Attendance</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => router.push({ pathname: '/messages', params: { partner: request.playerId } } as any)}
              activeOpacity={0.8}>
              <MessageCircle size={14} color={theme.textSecondary} strokeWidth={2} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, cancelling && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>{cancelling ? 'Cancelling…' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Past — just message */}
        {showActions && !isUpcoming && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => router.push({ pathname: '/messages', params: { partner: request.playerId } } as any)}
              activeOpacity={0.8}>
              <MessageCircle size={14} color={theme.textSecondary} strokeWidth={2} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <CoachMarkCompleteSheet
        visible={showAttendance}
        playerName={request.playerName}
        onClose={() => setShowAttendance(false)}
        onMarkComplete={async () => { await onMarkComplete(request.id); setShowAttendance(false); }}
        onMarkNoShow={async () => { await onMarkNoShow(request.id); setShowAttendance(false); }}
      />
    </>
  );
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(47,217,139,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 15,
      color: Colors.positive,
    },
    headerInfo: { flex: 1, gap: 3 },
    playerName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    lessonMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      flex: 1,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    completeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Colors.positive,
      borderRadius: Radius.button,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    completeBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },
    messageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.border,
    },
    messageBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    cancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.30)',
    },
    cancelBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    btnDisabled: { opacity: 0.4 },
  }), [theme]);
}
