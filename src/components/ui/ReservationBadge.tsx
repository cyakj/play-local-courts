import { StyleSheet, Text, View } from 'react-native';
import { Check, Clock, History, Play, X } from 'lucide-react-native';

import { FontFamily, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { reservationBadge, type BadgeIcon, type BadgeTone, type ReservationKind } from '@/lib/reservationState';

// Text/accents per tone and theme mode, picked for >= 4.5:1 on the tinted background in both modes.
const TONES: Record<'dark' | 'light', Record<BadgeTone, { fg: string; bg: string; border: string }>> = {
  dark: {
    positive: { fg: '#2FD98B', bg: 'rgba(47,217,139,0.15)', border: 'rgba(47,217,139,0.40)' },
    info: { fg: '#8DB0FF', bg: 'rgba(45,107,255,0.20)', border: 'rgba(45,107,255,0.55)' },
    warning: { fg: '#F5B63D', bg: 'rgba(245,182,61,0.16)', border: 'rgba(245,182,61,0.50)' },
    negative: { fg: '#FF7A86', bg: 'rgba(255,92,107,0.14)', border: 'rgba(255,92,107,0.45)' },
    muted: { fg: '#9AA3B8', bg: 'rgba(122,131,154,0.14)', border: 'rgba(122,131,154,0.35)' },
  },
  light: {
    positive: { fg: '#0B7A4B', bg: 'rgba(47,217,139,0.16)', border: 'rgba(11,122,75,0.35)' },
    info: { fg: '#1D4ED8', bg: 'rgba(45,107,255,0.12)', border: 'rgba(29,78,216,0.35)' },
    warning: { fg: '#7A4E00', bg: 'rgba(245,182,61,0.22)', border: 'rgba(122,78,0,0.40)' },
    negative: { fg: '#B4233A', bg: 'rgba(255,92,107,0.12)', border: 'rgba(180,35,58,0.35)' },
    muted: { fg: '#4B5468', bg: 'rgba(90,99,121,0.12)', border: 'rgba(75,84,104,0.30)' },
  },
};

export function toneColors(mode: 'dark' | 'light', tone: BadgeTone) {
  return TONES[mode][tone];
}

export function BadgeIconView({ icon, color, size = 12 }: { icon: BadgeIcon; color: string; size?: number }) {
  const p = { color, size, strokeWidth: 2.25 } as const;
  if (icon === 'check') return <Check {...p} />;
  if (icon === 'clock') return <Clock {...p} />;
  if (icon === 'play') return <Play {...p} />;
  if (icon === 'x') return <X {...p} />;
  return <History {...p} />;
}

/** Status pill for a reservation: icon + text from the single derivation in lib/reservationState. */
export function ReservationBadge({ kind, testID, label }: { kind: ReservationKind; testID?: string; label?: string }) {
  const { mode } = useTheme();
  const b = reservationBadge(kind);
  const c = toneColors(mode === 'light' ? 'light' : 'dark', b.tone);
  return (
    <View testID={testID ?? 'reservation-badge'} accessibilityLabel={label ?? b.label} style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
      <BadgeIconView icon={b.icon} color={c.fg} />
      <Text style={[styles.text, { color: c.fg }]}>{label ?? b.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
  text: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12 },
});
