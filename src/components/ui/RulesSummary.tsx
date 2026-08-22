import { StyleSheet, Text, View } from 'react-native';
import { FontFamily, FontSize, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';
import { formatTime12h } from '@/lib/format';

type AmenityRules = Database['public']['Tables']['amenity_rules']['Row'];

interface RulesSummaryProps {
  rules: Partial<AmenityRules>;
  theme: ThemeTokens;
}

export function RulesSummary({ rules, theme }: RulesSummaryProps) {
  const lines: string[] = [];

  if (rules.booking_start_time && rules.booking_end_time) {
    lines.push(`Open ${formatTime12h(rules.booking_start_time)}–${formatTime12h(rules.booking_end_time)}`);
  }
  if (rules.max_duration_minutes) {
    lines.push(`${rules.max_duration_minutes}-minute reservations`);
  }
  if (rules.advance_booking_days) {
    lines.push(`Book up to ${rules.advance_booking_days} day${rules.advance_booking_days === 1 ? '' : 's'} ahead`);
  }
  if (rules.min_cancellation_hours) {
    lines.push(`Cancel at least ${rules.min_cancellation_hours} hour${rules.min_cancellation_hours === 1 ? '' : 's'} before`);
  }
  if (rules.max_reservations_per_day) {
    lines.push(`Maximum ${rules.max_reservations_per_day} reservation${rules.max_reservations_per_day === 1 ? '' : 's'}/day`);
  }
  if (rules.requires_admin_approval) {
    lines.push('Admin approval required');
  }

  if (lines.length === 0) {
    return (
      <View style={s(theme).wrap}>
        <Text style={s(theme).empty}>No booking rules configured yet.</Text>
      </View>
    );
  }

  return (
    <View style={s(theme).wrap}>
      {lines.map((line, i) => (
        <Text key={i} style={s(theme).line}>{line}</Text>
      ))}
    </View>
  );
}

function s(theme: ThemeTokens) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: 'rgba(45,107,255,0.08)',
      borderRadius: Radius.card,
      padding: 14,
      gap: 4,
    },
    line: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textPrimary },
    empty: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.uiLabel, color: theme.textMuted },
  });
}
