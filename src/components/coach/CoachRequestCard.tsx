import { useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, Clock, MapPin, User, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachLessonRequest } from '@/hooks/useCoachRequests';
import { CoachDeclineSheet } from './CoachDeclineSheet';

const LESSON_TYPE_LABELS: Record<string, string> = {
  private_lesson:      'Private Lesson',
  semi_private_lesson: 'Semi-Private',
  group_clinic:        'Group Clinic',
  practice_session:    'Practice Session',
  private:             'Private Lesson',
  'semi-private':      'Semi-Private',
  group:               'Group Clinic',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner:         'Beginner',
  intermediate:     'Intermediate',
  high_performance: 'High Perf',
};

interface Props {
  request: CoachLessonRequest;
  onAccept: (req: CoachLessonRequest) => void;
  onDecline: (id: string, reason?: string) => Promise<void>;
}

export function CoachRequestCard({ request, onAccept, onDecline }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const initials = (request.playerName ?? 'P')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const preferredDateDisplay = useMemo(() => {
    if (!request.preferredDate) return null;
    return new Date(request.preferredDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }, [request.preferredDate]);

  const expiresIn = useMemo(() => {
    if (!request.expiresAt) return null;
    const ms = new Date(request.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    if (h < 1) return '< 1h left';
    if (h < 24) return `${h}h left`;
    return `${Math.floor(h / 24)}d left`;
  }, [request.expiresAt]);

  const isUrgent = useMemo(() => {
    if (!request.expiresAt) return false;
    const h = (new Date(request.expiresAt).getTime() - Date.now()) / 3600000;
    return h > 0 && h <= 12;
  }, [request.expiresAt]);

  const timeRange = `${fmtTime(request.preferredTimeStart)} – ${fmtTime(request.preferredTimeEnd)}`;

  return (
    <>
      <View style={[styles.card, isUrgent && styles.cardUrgent]}>
        {/* Header row */}
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
              {request.skillLevel ? ` · ${LEVEL_LABELS[request.skillLevel] ?? request.skillLevel}` : ''}
            </Text>
          </View>
          <StatusPill status="pending" label="PENDING" />
        </View>

        {/* Date / time row */}
        <View style={styles.infoRow}>
          <Clock size={13} color={theme.textMuted} strokeWidth={1.8} />
          <Text style={styles.infoText}>
            {preferredDateDisplay ? `${preferredDateDisplay} · ` : ''}{timeRange}
          </Text>
        </View>

        {/* Location */}
        {(request.locationPreference || request.facilityName) && (
          <View style={styles.infoRow}>
            <MapPin size={13} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={styles.infoText} numberOfLines={1}>
              {request.facilityName ?? request.locationPreference}
              {request.locationPreference && request.facilityName ? ` · ${request.locationPreference}` : ''}
            </Text>
          </View>
        )}

        {/* Expiry */}
        {expiresIn && (
          <Text style={[styles.expiryTxt, isUrgent && styles.expiryUrgent]}>
            {isUrgent ? `⚠ ${expiresIn}` : `Expires: ${expiresIn}`}
          </Text>
        )}

        {/* Player note (expandable) */}
        {request.notes && (
          <TouchableOpacity
            style={styles.noteToggle}
            onPress={() => setExpanded(v => !v)}
            activeOpacity={0.7}>
            <User size={12} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={styles.noteLabel}>Player note</Text>
            {expanded
              ? <ChevronUp size={12} color={theme.textMuted} strokeWidth={2} />
              : <ChevronDown size={12} color={theme.textMuted} strokeWidth={2} />}
          </TouchableOpacity>
        )}
        {expanded && request.notes && (
          <Text style={styles.noteText}>{request.notes}</Text>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => onAccept(request)}
            activeOpacity={0.85}>
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => setShowDecline(true)}
            activeOpacity={0.85}>
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push({ pathname: '/messages', params: { partner: request.playerId } } as any)}
            activeOpacity={0.8}>
            <MessageCircle size={14} color={theme.textSecondary} strokeWidth={2} />
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CoachDeclineSheet
        visible={showDecline}
        playerName={request.playerName}
        onClose={() => setShowDecline(false)}
        onDecline={async (reason) => {
          await onDecline(request.id, reason);
          setShowDecline(false);
        }}
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
    cardUrgent: {
      borderColor: 'rgba(214,255,61,0.40)',
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
      backgroundColor: 'rgba(45,107,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 15,
      color: Colors.blue,
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
    expiryTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
      letterSpacing: 0.3,
    },
    expiryUrgent: {
      color: Colors.volt,
    },
    noteToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    noteLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
      flex: 1,
    },
    noteText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
      paddingLeft: 17,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    acceptBtn: {
      flex: 1,
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 12,
      alignItems: 'center',
    },
    acceptBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },
    declineBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.40)',
      borderRadius: Radius.button,
      paddingVertical: 12,
      alignItems: 'center',
    },
    declineBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    messageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.border,
    },
    messageBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
  }), [theme]);
}
