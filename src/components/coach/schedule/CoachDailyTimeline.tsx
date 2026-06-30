import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Ban,
  CalendarClock,
  Check,
  Eye,
  MapPin,
  MessageCircle,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachLessonRequest } from '@/hooks/useCoachRequests';
import type { TimelineItem } from '@/hooks/useCoachDailyTimeline';
import { formatTime } from '@/types/coachSchedule';
import { LessonWeather } from '@/components/weather/LessonWeather';
import { CoachMarkCompleteSheet } from '@/components/coach/CoachMarkCompleteSheet';
import { CoachNotesSheet, RescheduleLessonSheet } from './LessonActionSheets';
import { formatStatus, formatLabel } from '@/lib/formatLabel';

const LESSON_LABELS: Record<string, string> = {
  private_lesson: 'Private Lesson',
  semi_private_lesson: 'Semi-Private Lesson',
  group_lesson: 'Group Lesson',
  group_clinic: 'Group Clinic',
  hitting_partner: 'Hitting Partner',
  practice_session: 'Practice Session',
  private: 'Private Lesson',
  'semi-private': 'Semi-Private Lesson',
  group: 'Group Lesson',
};

const BLOCKOUT_LABELS: Record<string, string> = {
  lunch: 'Lunch',
  personal: 'Personal',
  tournament: 'Tournament',
  vacation: 'Vacation',
  facility_unavailable: 'Facility unavailable',
  travel_time: 'Travel time',
  other: 'Other',
  legacy_unavailability: 'Unavailable',
};

function timeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function lessonDate(request: CoachLessonRequest): string {
  const value = request.confirmedDate ?? request.preferredDate;
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function messagePlayer(playerId: string) {
  router.push({ pathname: '/messages', params: { partner: playerId } } as any);
}

interface Props {
  items: TimelineItem[];
  loading: boolean;
  selectedDateLabel: string;
  onAccept: (request: CoachLessonRequest) => Promise<void>;
  onDecline: (request: CoachLessonRequest) => Promise<void>;
  onCancelLesson: (request: CoachLessonRequest, reason?: string) => Promise<void>;
  onMarkComplete: (request: CoachLessonRequest) => Promise<void>;
  onMarkNoShow: (request: CoachLessonRequest) => Promise<void>;
  onEditRule: (item: Extract<TimelineItem, { kind: 'open' }>) => void;
  onEditUnavailable: (item: Extract<TimelineItem, { kind: 'unavailable' }>) => void;
  onRemoveUnavailable: (item: Extract<TimelineItem, { kind: 'unavailable' }>) => Promise<void>;
  onRescheduleSuccess?: () => void;
}

export function CoachDailyTimeline({
  items,
  loading,
  selectedDateLabel,
  onAccept,
  onDecline,
  onCancelLesson,
  onMarkComplete,
  onMarkNoShow,
  onEditRule,
  onEditUnavailable,
  onRemoveUnavailable,
  onRescheduleSuccess,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [lessonDetails, setLessonDetails] = useState<CoachLessonRequest | null>(null);
  const [rescheduleRequest, setRescheduleRequest] = useState<CoachLessonRequest | null>(null);
  const [notesRequest, setNotesRequest] = useState<CoachLessonRequest | null>(null);
  const [coachNotes, setCoachNotes] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState('');
  const [openDetails, setOpenDetails] = useState<Extract<TimelineItem, { kind: 'open' }> | null>(null);
  const [unavailableDetails, setUnavailableDetails] =
    useState<Extract<TimelineItem, { kind: 'unavailable' }> | null>(null);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Loading daily schedule...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.timeline}>
        {items.map(item => {
          if (item.kind === 'lesson') {
            return (
              <LessonCard
                key={item.id}
                item={item}
                onDetails={() => setLessonDetails(item.request)}
                onCancel={() => Alert.alert(
                  'Cancel lesson?',
                  'The student will be notified. This time will not be promoted or automatically refilled.',
                  [
                    { text: 'Keep Lesson', style: 'cancel' },
                    {
                      text: 'Cancel Lesson',
                      style: 'destructive',
                      onPress: () => void onCancelLesson(item.request),
                    },
                  ],
                )}
                onReschedule={() => setRescheduleRequest(item.request)}
              />
            );
          }
          if (item.kind === 'pending') {
            return (
              <PendingCard
                key={item.id}
                item={item}
                onAccept={() => onAccept(item.request)}
                onDecline={() => onDecline(item.request)}
              />
            );
          }
          if (item.kind === 'clinic') {
            return (
              <ClinicCard
                key={item.id}
                item={item}
                onPress={() => router.push('/(coach)/clinics' as any)}
              />
            );
          }
          if (item.kind === 'open') {
            return (
              <OpenSlotCard
                key={item.id}
                item={item}
                onDetails={() => setOpenDetails(item)}
                onEdit={() => onEditRule(item)}
              />
            );
          }
          return (
            <UnavailableCard
              key={item.id}
              item={item}
              onView={() => setUnavailableDetails(item)}
              onEdit={() => onEditUnavailable(item)}
              onRemove={() => onRemoveUnavailable(item)}
            />
          );
        })}
      </View>

      <LessonDetailsSheet
        request={lessonDetails}
        onClose={() => setLessonDetails(null)}
        coachNote={lessonDetails ? coachNotes[lessonDetails.playerId] : ''}
        onEditNotes={() => {
          if (!lessonDetails) return;
          setNotesRequest(lessonDetails);
          setLessonDetails(null);
        }}
        onMessage={() => {
          if (!lessonDetails) return;
          const playerId = lessonDetails.playerId;
          setLessonDetails(null);
          setTimeout(() => messagePlayer(playerId), 0);
        }}
        onReschedule={() => {
          if (!lessonDetails) return;
          setRescheduleRequest(lessonDetails);
          setLessonDetails(null);
        }}
        onCancel={async reason => {
          if (!lessonDetails) return;
          await onCancelLesson(lessonDetails, reason);
          setLessonDetails(null);
        }}
        onMarkComplete={async () => {
          if (!lessonDetails) return;
          await onMarkComplete(lessonDetails);
          setLessonDetails(null);
        }}
        onMarkNoShow={async () => {
          if (!lessonDetails) return;
          await onMarkNoShow(lessonDetails);
          setLessonDetails(null);
        }}
        onShowToast={msg => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(''), 2500);
        }}
      />
      <RescheduleLessonSheet
        request={rescheduleRequest}
        onClose={() => setRescheduleRequest(null)}
        onSuccess={() => {
          setRescheduleRequest(null);
          setToastMessage('Reschedule request sent.');
          setTimeout(() => setToastMessage(''), 2500);
          onRescheduleSuccess?.();
        }}
      />
      <CoachNotesSheet
        request={notesRequest}
        onClose={() => setNotesRequest(null)}
        onSaved={note => {
          if (notesRequest) {
            setCoachNotes(current => ({ ...current, [notesRequest.playerId]: note }));
            setLessonDetails(notesRequest);
          }
          setToastMessage('Coach notes saved.');
          setTimeout(() => setToastMessage(''), 2200);
        }}
      />
      <OpenSlotDetailsSheet
        item={openDetails}
        selectedDateLabel={selectedDateLabel}
        onClose={() => setOpenDetails(null)}
        onEdit={() => openDetails && onEditRule(openDetails)}
      />
      <UnavailableDetailsSheet
        item={unavailableDetails}
        onClose={() => setUnavailableDetails(null)}
        onEdit={() => unavailableDetails && onEditUnavailable(unavailableDetails)}
        onRemove={async () => {
          if (!unavailableDetails) return;
          await onRemoveUnavailable(unavailableDetails);
          setUnavailableDetails(null);
        }}
      />
      {!!toastMessage && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </>
  );
}

function TimelineShell({
  code,
  color,
  muted,
  children,
}: {
  code: string;
  color: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={[styles.timelineRow, muted && styles.muted]}>
      <View style={[styles.codeBadge, { backgroundColor: color }]}>
        <Text style={[styles.codeText, color === Colors.volt || color === Colors.cyan || color === '#FF8C42'
          ? styles.darkCode : null]}>
          {code}
        </Text>
      </View>
      <View style={styles.timelineContent}>{children}</View>
    </View>
  );
}

function LessonCard({
  item,
  onDetails,
  onCancel,
  onReschedule,
}: {
  item: Extract<TimelineItem, { kind: 'lesson' }>;
  onDetails: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const request = item.request;
  const isFinalized = request.attendanceStatus === 'attended' ||
    ['completed', 'no_show'].includes(request.status);
  return (
    <TimelineShell code="L" color="#0F1F3D">
      <TouchableOpacity style={styles.card} onPress={onDetails} activeOpacity={0.82}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.time}>{timeRange(item.start, item.end)}</Text>
            <Text style={styles.title}>{request.playerName ?? 'Player'}</Text>
          </View>
          <View style={styles.statusCol}>
            <Text style={styles.status}>{formatStatus(request.status)}</Text>
            {!!request.counterProposedDate && (
              <Text style={styles.rescheduleBadge}>RESCHEDULE PROPOSED</Text>
            )}
          </View>
        </View>
        <Text style={styles.meta}>
          {LESSON_LABELS[request.lessonType] ?? formatLabel(request.lessonType)}
          {request.durationMinutes ? ` · ${request.durationMinutes} min` : ''}
        </Text>
        {!!(request.facilityName || request.locationPreference) && (
          <InfoRow icon={<MapPin size={16} color={theme.textMuted} />}>
            {request.facilityName ?? request.locationPreference}
          </InfoRow>
        )}
        <View style={styles.actions}>
          <Action label="Message" icon={<MessageCircle size={16} color={theme.textSecondary} />} onPress={() => messagePlayer(request.playerId)} />
          <Action label="View Details" icon={<Eye size={16} color={theme.textSecondary} />} onPress={onDetails} />
          {!isFinalized && (
            <Action label="Reschedule" primary icon={<RotateCcw size={16} color="#F5F8FF" />} onPress={onReschedule} />
          )}
          {!isFinalized && (
            <Action label="Cancel Lesson" destructive onPress={onCancel} />
          )}
        </View>
      </TouchableOpacity>
    </TimelineShell>
  );
}

function PendingCard({
  item,
  onAccept,
  onDecline,
}: {
  item: Extract<TimelineItem, { kind: 'pending' }>;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const request = item.request;
  const expires = request.expiresAt
    ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / 3600000))
    : null;
  return (
    <TimelineShell code="P" color="#FF8C42">
      <View style={[styles.card, styles.pendingCard]}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.time}>{timeRange(item.start, item.end)}</Text>
            <Text style={styles.title}>{request.playerName ?? 'Player'}</Text>
          </View>
          <Text style={styles.pendingStatus}>PENDING</Text>
        </View>
        <Text style={styles.meta}>
          {LESSON_LABELS[request.lessonType] ?? request.lessonType}
          {request.durationMinutes ? ` · ${request.durationMinutes} min` : ''}
        </Text>
        {!!(request.facilityName || request.locationPreference) && (
          <InfoRow icon={<MapPin size={16} color={theme.textMuted} />}>
            {request.facilityName ?? request.locationPreference}
          </InfoRow>
        )}
        {expires != null && <Text style={styles.expiry}>Expires in {expires}h</Text>}
        <View style={styles.actions}>
          <Action label="Accept" primary icon={<Check size={16} color="#F5F8FF" />} onPress={onAccept} />
          <Action label="Decline" destructive onPress={onDecline} />
          <Action label="Message" icon={<MessageCircle size={16} color={theme.textSecondary} />} onPress={() => messagePlayer(request.playerId)} />
        </View>
      </View>
    </TimelineShell>
  );
}

function OpenSlotCard({
  item,
  onDetails,
  onEdit,
}: {
  item: Extract<TimelineItem, { kind: 'open' }>;
  onDetails: () => void;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const config = {
    facility: { code: 'F', color: Colors.blue, label: 'Facility' },
    travel: { code: 'T', color: Colors.volt, label: 'Travel' },
    flexible: { code: 'E', color: Colors.cyan, label: 'Flexible / Either' },
  }[item.slotType];
  return (
    <TimelineShell code={config.code} color={config.color} muted={!item.publiclyBookable}>
      <TouchableOpacity style={styles.card} onPress={onDetails} activeOpacity={0.82}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.time}>{timeRange(item.start, item.end)}</Text>
            <Text style={styles.title}>Open Availability Window</Text>
          </View>
          <Text style={item.publiclyBookable ? styles.publicStatus : styles.privateStatus}>
            {item.publiclyBookable ? 'PUBLIC' : 'PRIVATE'}
          </Text>
        </View>
        <Text style={styles.meta}>{config.label}</Text>
        {!!item.facilityName && <InfoRow icon={<MapPin size={16} color={theme.textMuted} />}>{item.facilityName}</InfoRow>}
        {item.travelRadiusMiles != null && (
          <Text style={styles.meta}>
            {item.travelRadiusMiles} mile radius
            {item.areasServed?.length ? ` · ${item.areasServed.join(', ')}` : ''}
          </Text>
        )}
        <View style={styles.actions}>
          <Action label="Edit Rule" icon={<Pencil size={16} color={theme.textSecondary} />} onPress={onEdit} />
        </View>
      </TouchableOpacity>
    </TimelineShell>
  );
}

function UnavailableCard({
  item,
  onView,
  onEdit,
  onRemove,
}: {
  item: Extract<TimelineItem, { kind: 'unavailable' }>;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <TimelineShell code="U" color="#5A6379">
      <View style={[styles.card, styles.unavailableCard]}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.time}>{timeRange(item.start, item.end)}</Text>
            <Text style={styles.title}>Unavailable</Text>
          </View>
          <Ban size={20} color={theme.textMuted} />
        </View>
        <Text style={styles.meta}>{BLOCKOUT_LABELS[item.type] ?? 'Unavailable'}</Text>
        <View style={styles.actions}>
          <Action label="View" icon={<Eye size={16} color={theme.textSecondary} />} onPress={onView} />
          <Action label="Edit" icon={<Pencil size={16} color={theme.textSecondary} />} onPress={onEdit} />
          {item.sourceKind === 'blockout' && (
            <Action label="Remove" destructive icon={<Trash2 size={16} color={Colors.negative} />} onPress={onRemove} />
          )}
        </View>
      </View>
    </TimelineShell>
  );
}

function ClinicCard({
  item,
  onPress,
}: {
  item: Extract<TimelineItem, { kind: 'clinic' }>;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <TimelineShell code="C" color={Colors.cyan}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.time}>{timeRange(item.start, item.end)}</Text>
            <Text style={styles.title}>{item.name}</Text>
          </View>
          <Text style={item.status === 'draft' ? styles.privateStatus : styles.publicStatus}>
            {item.status === 'draft' ? 'DRAFT' : 'LIVE'}
          </Text>
        </View>
        <Text style={styles.meta}>
          {item.enrolledCount} / {item.maxPlayers} players enrolled
        </Text>
        {!!item.location && (
          <InfoRow icon={<MapPin size={16} color={theme.textMuted} />}>{item.location}</InfoRow>
        )}
        <View style={styles.actions}>
          <Action label="Manage Clinics" icon={<Eye size={16} color={theme.textSecondary} />} onPress={onPress} />
        </View>
      </TouchableOpacity>
    </TimelineShell>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.infoRow}>
      {icon}
      <Text style={styles.infoText} numberOfLines={2}>{children}</Text>
    </View>
  );
}

function Action({
  label,
  icon,
  primary,
  destructive,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  primary?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.action, primary && styles.primaryAction, destructive && styles.destructiveAction]}
      onPress={onPress}
      activeOpacity={0.78}>
      {icon}
      <Text style={[
        styles.actionText,
        primary && styles.primaryActionText,
        destructive && styles.destructiveActionText,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DetailsSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function LessonDetailsSheet({
  request,
  coachNote,
  onClose,
  onEditNotes,
  onMessage,
  onReschedule,
  onCancel,
  onMarkComplete,
  onMarkNoShow,
  onShowToast,
}: {
  request: CoachLessonRequest | null;
  coachNote: string;
  onClose: () => void;
  onEditNotes: () => void;
  onMessage: () => void;
  onReschedule: () => void;
  onCancel: (reason?: string) => Promise<void>;
  onMarkComplete: () => Promise<void>;
  onMarkNoShow: () => Promise<void>;
  onShowToast: (msg: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [reason, setReason] = useState('');
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  if (!request) return null;
  const start = request.confirmedTimeStart ?? request.preferredTimeStart;
  const end = request.confirmedTimeEnd ?? request.preferredTimeEnd;
  const initials = (request.playerName ?? 'P').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const isFinalized = request.attendanceStatus === 'attended' ||
    ['completed', 'no_show'].includes(request.status);
  return (
    <DetailsSheet visible title="Lesson Details" onClose={onClose}>
      <View style={styles.studentRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.studentCopy}>
          <Text style={styles.studentName}>{request.playerName ?? 'Player'}</Text>
          <Text style={styles.meta}>{LESSON_LABELS[request.lessonType] ?? formatLabel(request.lessonType)}</Text>
        </View>
      </View>
      <DetailRow label="DATE" value={lessonDate(request)} />
      <DetailRow label="TIME" value={timeRange(start, end)} />
      <DetailRow label="DURATION" value={request.durationMinutes ? `${request.durationMinutes} minutes` : null} />
      <DetailRow label="STATUS" value={formatStatus(request.status)} />
      {!!request.counterProposedDate && (
        <DetailRow
          label="RESCHEDULE PROPOSED"
          value={`${new Date(`${request.counterProposedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${request.counterProposedTimeStart ? `  ·  ${formatTime(request.counterProposedTimeStart)}` : ''}`}
        />
      )}
      <DetailRow label="LOCATION TYPE" value={request.locationPreference ? formatLabel(request.locationPreference) : null} />
      <DetailRow label="FACILITY / LOCATION" value={request.facilityName ?? request.locationNote} />
      <LessonWeather
        date={request.confirmedDate ?? request.preferredDate}
        time={start}
        location={request.facilityName ?? request.locationNote}
      />
      <DetailRow label="STUDENT NOTES" value={request.notes} />
      <View style={styles.notesStub}>
        <Text style={styles.detailLabel}>COACH NOTES</Text>
        <Text style={styles.notesStubText}>
          {coachNote || 'No private coach notes yet.'}
        </Text>
      </View>
      <Action
        label="Add / Edit Coach Notes"
        icon={<Pencil size={16} color={theme.textSecondary} />}
        onPress={onEditNotes}
      />
      <Action label="Message Student" primary icon={<MessageCircle size={16} color="#F5F8FF" />} onPress={onMessage} />
      {!isFinalized && (
        <Action label="Reschedule Lesson" primary icon={<CalendarClock size={16} color="#F5F8FF" />} onPress={onReschedule} />
      )}
      {!isFinalized && (
        <Action label="Mark Attendance" icon={<Check size={16} color={theme.textSecondary} />} onPress={() => setAttendanceOpen(true)} />
      )}
      {!isFinalized && (
        <>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Optional cancellation explanation"
            placeholderTextColor={theme.textMuted}
            style={styles.reasonInput}
            multiline
          />
          <Action
            label="Cancel Lesson"
            destructive
            onPress={() => Alert.alert(
              'Cancel lesson?',
              'The student will be notified. This time will not be promoted or automatically refilled.',
              [
                { text: 'Keep Lesson', style: 'cancel' },
                { text: 'Cancel Lesson', style: 'destructive', onPress: () => onCancel(reason) },
              ],
            )}
          />
        </>
      )}
      <CoachMarkCompleteSheet
        visible={attendanceOpen}
        playerName={request.playerName}
        onClose={() => setAttendanceOpen(false)}
        onMarkComplete={async () => {
          await onMarkComplete();
          setAttendanceOpen(false);
          onShowToast('Lesson marked as completed.');
        }}
        onMarkNoShow={async () => {
          await onMarkNoShow();
          setAttendanceOpen(false);
          onShowToast('No-show recorded.');
        }}
      />
    </DetailsSheet>
  );
}

function OpenSlotDetailsSheet({
  item,
  selectedDateLabel,
  onClose,
  onEdit,
}: {
  item: Extract<TimelineItem, { kind: 'open' }> | null;
  selectedDateLabel: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  if (!item) return null;
  return (
    <DetailsSheet visible title="Open Slot Details" onClose={onClose}>
      <DetailRow label="DATE" value={selectedDateLabel} />
      <DetailRow label="TIME" value={timeRange(item.start, item.end)} />
      <DetailRow label="SLOT TYPE" value={item.slotType === 'flexible' ? 'Flexible / Either' : item.slotType} />
      <DetailRow label="VISIBILITY" value={item.publiclyBookable ? 'Public' : 'Private / internal'} />
      <DetailRow
        label="SOURCE RULE"
        value={item.sourceKind === 'teaching' ? 'Teaching block' : 'Legacy booking availability'}
      />
      <DetailRow label="FACILITY" value={item.facilityName} />
      <DetailRow label="FACILITY ADDRESS" value={item.facilityAddress} />
      <DetailRow label="TRAVEL RADIUS" value={item.travelRadiusMiles != null ? `${item.travelRadiusMiles} miles` : null} />
      <DetailRow label="AREAS SERVED" value={item.areasServed?.join(', ')} />
      <Action label="Edit Source Rule" primary icon={<Pencil size={16} color="#F5F8FF" />} onPress={onEdit} />
    </DetailsSheet>
  );
}

function UnavailableDetailsSheet({
  item,
  onClose,
  onEdit,
  onRemove,
}: {
  item: Extract<TimelineItem, { kind: 'unavailable' }> | null;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (!item) return null;
  return (
    <DetailsSheet visible title="Unavailable Time" onClose={onClose}>
      <DetailRow label="TIME" value={timeRange(item.start, item.end)} />
      <DetailRow label="TYPE" value={BLOCKOUT_LABELS[item.type] ?? 'Unavailable'} />
      <DetailRow label="INTERNAL NOTE" value={item.internalNote} />
      <Text style={{ color: Colors.fg2, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label }}>
        Players only see that this time is unavailable. They never see the type or internal note.
      </Text>
      <Action label="Edit" primary icon={<Pencil size={16} color="#F5F8FF" />} onPress={onEdit} />
      {item.sourceKind === 'blockout' && <Action label="Remove" destructive icon={<Trash2 size={16} color={Colors.negative} />} onPress={onRemove} />}
    </DetailsSheet>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    timeline: { gap: 14 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    muted: { opacity: 0.64 },
    codeBadge: {
      width: 34,
      height: 34,
      borderRadius: Radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    codeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      color: '#F5F8FF',
    },
    darkCode: { color: '#0C0F18' },
    timelineContent: { flex: 1 },
    card: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      padding: Spacing.cardPadding,
      gap: 10,
      ...theme.shadowCard,
    },
    pendingCard: { borderColor: 'rgba(255,140,66,0.38)' },
    unavailableCard: { backgroundColor: theme.surface2 },
    cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardHeadingCopy: { flex: 1, gap: 3 },
    time: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      color: Colors.cyan,
    },
    title: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    statusCol: { alignItems: 'flex-end', gap: 4 },
    status: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: Colors.positive,
    },
    rescheduleBadge: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: '#FF8C42',
      letterSpacing: 0.5,
    },
    pendingStatus: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: '#FF8C42',
    },
    publicStatus: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: Colors.cyan,
    },
    privateStatus: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
    },
    meta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    expiry: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: '#FF8C42',
    },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
    infoText: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    action: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    actionText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: theme.textSecondary,
    },
    primaryAction: { backgroundColor: Colors.blue, borderColor: Colors.blue },
    primaryActionText: { color: '#F5F8FF' },
    destructiveAction: { borderColor: 'rgba(255,92,107,0.42)' },
    destructiveActionText: { color: Colors.negative },
    loadingState: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
    },
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.backdrop },
    sheet: {
      maxHeight: '90%',
      backgroundColor: theme.sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowSheet,
    },
    sheetHeader: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: Spacing.pagePx,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetTitle: {
      flex: 1,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    closeButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
    sheetContent: { padding: Spacing.pagePx, gap: 14 },
    studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(45,224,255,0.12)',
    },
    avatarText: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: Colors.cyan,
    },
    studentCopy: { flex: 1, gap: 3 },
    studentName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    detailRow: {
      gap: 4,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    detailLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1,
    },
    detailValue: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      lineHeight: 22,
      color: theme.textPrimary,
      textTransform: 'capitalize',
    },
    notesStub: {
      gap: 5,
      padding: 12,
      borderRadius: Radius.sm,
      backgroundColor: theme.surface2,
    },
    notesStubText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    reasonInput: {
      minHeight: 82,
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      padding: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      textAlignVertical: 'top',
    },
    toast: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 28,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(47,217,139,0.45)',
      backgroundColor: '#10251D',
      paddingHorizontal: 16,
      zIndex: 100,
    },
    toastText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.positive,
    },
  }), [theme]);
}
