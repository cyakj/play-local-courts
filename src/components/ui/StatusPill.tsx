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
  optimal:           { bg: 'rgba(47,217,139,0.15)',  text: '#1A9E63', border: 'rgba(47,217,139,0.40)', label: 'Optimal' },
  'needs-attention': { bg: 'rgba(255,92,107,0.12)',  text: '#D63B4E', border: 'rgba(255,92,107,0.40)', label: 'Needs Attention' },
  critical:          { bg: 'rgba(255,92,107,0.12)',  text: '#D63B4E', border: 'rgba(255,92,107,0.40)', label: 'Critical' },
  pending:           { bg: 'rgba(245,158,11,0.14)',  text: '#92400E', border: 'rgba(245,158,11,0.45)', label: 'Pending' },
  approved:          { bg: 'rgba(47,217,139,0.15)',  text: '#1A9E63', border: 'rgba(47,217,139,0.40)', label: 'Approved' },
  rejected:          { bg: 'rgba(255,92,107,0.12)',  text: '#D63B4E', border: 'rgba(255,92,107,0.40)', label: 'Rejected' },
  open:              { bg: 'rgba(45,107,255,0.12)',  text: '#1E4FCC', border: 'rgba(45,107,255,0.35)', label: 'Open' },
  'in-progress':     { bg: 'rgba(245,158,11,0.14)',  text: '#92400E', border: 'rgba(245,158,11,0.45)', label: 'In Progress' },
  resolved:          { bg: 'rgba(47,217,139,0.15)',  text: '#1A9E63', border: 'rgba(47,217,139,0.40)', label: 'Resolved' },
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
