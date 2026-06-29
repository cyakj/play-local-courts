import { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin, ShieldCheck } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchFormat = 'singles' | 'doubles' | 'casual_hit';

export interface MatchListing {
  id: string;
  creator_id: string;
  format: MatchFormat;
  match_date: string;
  start_time: string;
  end_time: string;
  ntrp_min?: number;
  ntrp_max?: number;
  location: string;
  court_reserved?: boolean;
  note: string | null;
  creator?: { full_name: string | null; avatar_url: string | null } | null;
}

export interface MatchCardProps {
  match: MatchListing;
  onPress: () => void;
  onJoin: () => void;
  joining?: boolean;
  theme: ThemeTokens;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(value: string): string {
  const [hourString, minute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(hourString);
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 || 12;
  return minute === '00' ? `${normalized} ${period}` : `${normalized}:${minute} ${period}`;
}

function formatLabel(format: MatchFormat): string {
  if (format === 'casual_hit') return 'Casual Hit';
  return format === 'singles' ? 'Singles' : 'Doubles';
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MatchCard = memo(function MatchCard({
  match, onPress, onJoin, joining = false, theme,
}: MatchCardProps) {
  const totalSlots = match.format === 'doubles' ? 4 : 2;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <Text style={styles.formatBadge}>{formatLabel(match.format).toUpperCase()}</Text>
        <View style={styles.badges}>
          {match.court_reserved && (
            <View style={styles.reservedBadge}>
              <ShieldCheck size={12} color={Colors.positive} strokeWidth={1.5} />
              <Text style={styles.reservedText}>Court Reserved</Text>
            </View>
          )}
          <Text style={[styles.creatorName, { color: theme.textSecondary }]}>
            {match.creator?.full_name ?? 'TenisX player'}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: theme.textPrimary }]}>
        {formatLabel(match.format)} · {new Date(`${match.match_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </Text>

      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: theme.textSecondary }]}>
          {formatTime(match.start_time)} – {formatTime(match.end_time)}
        </Text>
        <Text style={[styles.metaText, { color: theme.textSecondary }]}>{totalSlots} player slots</Text>
        <Text style={[styles.metaText, { color: theme.textSecondary }]}>
          NTRP {(match.ntrp_min ?? 1).toFixed(1)}–{(match.ntrp_max ?? 7).toFixed(1)}
        </Text>
      </View>

      <View style={styles.locationRow}>
        <MapPin size={16} color={Colors.cyan} strokeWidth={1.5} />
        <Text style={[styles.locationText, { color: theme.textSecondary }]}>{match.location}</Text>
      </View>

      {!!match.note && (
        <Text style={[styles.note, { color: theme.textSecondary }]}>{match.note}</Text>
      )}

      <TouchableOpacity
        style={styles.joinButton}
        onPress={onJoin}
        disabled={joining}
        activeOpacity={0.8}
      >
        {joining
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.joinButtonText}>Join Match</Text>
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: Spacing.cardPadding,
    borderRadius: Radius.card,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatBadge: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.cyan,
    letterSpacing: 0.1,
  },
  reservedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(47,217,139,0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reservedText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 10,
    color: Colors.positive,
  },
  creatorName: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
  },
  title: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.cardTitle,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metaText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    flex: 1,
  },
  note: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    lineHeight: 23,
  },
  joinButton: {
    minHeight: Spacing.tapTarget + 2,
    backgroundColor: Colors.blue,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: Colors.white,
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
  },
});
