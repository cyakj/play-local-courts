import { StyleSheet, Text, View } from 'react-native';
import { FontFamily, Radius } from '@/constants/design';

type StatusVariant =
  | 'optimal'
  | 'needs-attention'
  | 'critical'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'open'
  | 'in-progress'
  | 'resolved'
  | 'confirmed'
  | 'counter-proposed'
  | 'declined'
  | 'expired'
  | 'no-show'
  | 'coach-cancelled'
  | 'completed';

const pillConfig: Record<
  StatusVariant,
  { bg: string; text: string; border: string; label: string }
> = {
  // Operational status
  optimal:           { bg: 'rgba(47,217,139,0.15)',  text: '#2FD98B', border: 'rgba(47,217,139,0.40)', label: 'Optimal' },
  'needs-attention': { bg: 'rgba(255,92,107,0.12)',  text: '#FF5C6B', border: 'rgba(255,92,107,0.40)', label: 'Needs Attention' },
  critical:          { bg: 'rgba(255,92,107,0.12)',  text: '#FF5C6B', border: 'rgba(255,92,107,0.40)', label: 'Critical' },
  // Request / approval flow
  pending:           { bg: 'rgba(245,158,11,0.14)',  text: '#F59E0B', border: 'rgba(245,158,11,0.45)', label: 'Pending' },
  approved:          { bg: 'rgba(47,217,139,0.15)',  text: '#2FD98B', border: 'rgba(47,217,139,0.40)', label: 'Approved' },
  rejected:          { bg: 'rgba(255,92,107,0.12)',  text: '#FF5C6B', border: 'rgba(255,92,107,0.40)', label: 'Rejected' },
  open:              { bg: 'rgba(45,107,255,0.12)',  text: '#5B8EFF', border: 'rgba(45,107,255,0.35)', label: 'Open' },
  'in-progress':     { bg: 'rgba(245,158,11,0.14)',  text: '#F59E0B', border: 'rgba(245,158,11,0.45)', label: 'In Progress' },
  resolved:          { bg: 'rgba(47,217,139,0.15)',  text: '#2FD98B', border: 'rgba(47,217,139,0.40)', label: 'Resolved' },
  // Lesson / coaching statuses
  confirmed:         { bg: 'rgba(45,224,255,0.12)',  text: '#2DE0FF', border: 'rgba(45,224,255,0.35)', label: 'Confirmed' },
  'counter-proposed':{ bg: 'rgba(245,158,11,0.14)',  text: '#F59E0B', border: 'rgba(245,158,11,0.45)', label: 'Counter Proposed' },
  declined:          { bg: 'rgba(255,92,107,0.12)',  text: '#FF5C6B', border: 'rgba(255,92,107,0.40)', label: 'Declined' },
  expired:           { bg: 'rgba(154,163,184,0.10)', text: '#7A839A', border: 'rgba(154,163,184,0.25)', label: 'Expired' },
  'no-show':         { bg: 'rgba(255,92,107,0.12)',  text: '#FF5C6B', border: 'rgba(255,92,107,0.40)', label: 'No Show' },
  'coach-cancelled': { bg: 'rgba(255,92,107,0.12)',  text: '#FF5C6B', border: 'rgba(255,92,107,0.40)', label: 'Cancelled' },
  completed:         { bg: 'rgba(45,224,255,0.12)',  text: '#2DE0FF', border: 'rgba(45,224,255,0.35)', label: 'Completed' },
};

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const config = pillConfig[status];
  return (
    <View style={[styles.pill, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[styles.text, { color: config.text }]}>{label ?? config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
