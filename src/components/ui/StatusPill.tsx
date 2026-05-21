import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/design';

type StatusVariant =
  | 'optimal'
  | 'needs-attention'
  | 'critical'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'open'
  | 'in-progress'
  | 'resolved';

const pillConfig: Record<
  StatusVariant,
  { bg: string; text: string; border: string; label: string }
> = {
  optimal:           { bg: Colors.optimalBg,    text: Colors.blueMid, border: Colors.accentCyan, label: 'Optimal' },
  'needs-attention': { bg: Colors.attentionBg,  text: '#C0392B',       border: Colors.coral,      label: 'Needs Attention' },
  critical:          { bg: Colors.criticalBg,   text: '#991B1B',       border: Colors.red,        label: 'Critical' },
  pending:           { bg: '#FFF9E6',            text: '#92400E',       border: '#F59E0B',         label: 'Pending' },
  approved:          { bg: Colors.optimalBg,    text: Colors.blueMid, border: Colors.accentCyan, label: 'Approved' },
  rejected:          { bg: Colors.criticalBg,   text: '#991B1B',       border: Colors.red,        label: 'Rejected' },
  open:              { bg: '#EFF6FF',            text: '#1D4ED8',       border: '#3B82F6',         label: 'Open' },
  'in-progress':     { bg: '#FFF9E6',            text: '#92400E',       border: '#F59E0B',         label: 'In Progress' },
  resolved:          { bg: Colors.optimalBg,    text: Colors.blueMid, border: Colors.accentCyan, label: 'Resolved' },
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
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    fontWeight: '700',
  },
});
