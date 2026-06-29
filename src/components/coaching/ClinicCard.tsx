import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarDays,
  Clock3,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  MapPin,
  Navigation,
  Sun,
  Users,
} from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { WeatherData } from '@/hooks/useWeather';

export interface ClinicCardData {
  id: string;
  name: string;
  coachName: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  skillMin: number | null;
  skillMax: number | null;
  ageGroup: string;
  maxPlayers: number;
  enrolledCount: number;
  distanceMiles?: number | null;
  clinicType?: string | null;
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function fmtTime(s: string): string {
  const [h, m] = s.slice(0, 5).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function ntrpLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'All levels';
  if (min != null && max != null) return `NTRP ${min.toFixed(1)}–${max.toFixed(1)}`;
  if (min != null) return `NTRP ${min.toFixed(1)}+`;
  return `NTRP up to ${(max ?? 0).toFixed(1)}`;
}

type WeatherCondition = WeatherData['condition'];

function WeatherConditionIcon({ condition }: { condition: WeatherCondition }) {
  const size = 13;
  const sw = 1.5;
  switch (condition) {
    case 'sunny':        return <Sun          size={size} color="#F5C518" strokeWidth={sw} />;
    case 'partly_cloudy':return <CloudSun     size={size} color="#F5C518" strokeWidth={sw} />;
    case 'cloudy':       return <Cloud        size={size} color="#9AA3B8" strokeWidth={sw} />;
    case 'rainy':        return <CloudRain    size={size} color="#6BBBFF" strokeWidth={sw} />;
    case 'stormy':       return <CloudLightning size={size} color="#B48EFF" strokeWidth={sw} />;
  }
}

const AGE_LABELS: Record<string, string> = {
  junior: 'JUNIORS',
  adult:  'ADULTS',
};

interface Props {
  clinic: ClinicCardData;
  onPress: () => void;
  weather?: WeatherData | null;
}

export function ClinicCard({ clinic, onPress, weather }: Props) {
  const { theme } = useTheme();
  const spotsLeft = Math.max(clinic.maxPlayers - clinic.enrolledCount, 0);
  const isFull = spotsLeft === 0;
  const spotsColor = spotsLeft <= 2 ? Colors.volt : Colors.positive;
  const ageLabel = AGE_LABELS[clinic.ageGroup];

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
            {clinic.name}
          </Text>
          <Text style={[styles.coach, { color: theme.textSecondary }]}>
            Coach: {clinic.coachName}
          </Text>
        </View>
        {ageLabel ? (
          <View style={styles.agePill}>
            <Text style={styles.agePillText}>{ageLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <CalendarDays size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {fmtDate(clinic.date)} · {fmtTime(clinic.startTime)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Clock3 size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {clinic.durationMinutes} min
          </Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
            {clinic.location}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Users size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {ntrpLabel(clinic.skillMin, clinic.skillMax)}
          </Text>
        </View>
        {weather ? (
          <View style={styles.metaRow}>
            <WeatherConditionIcon condition={weather.condition} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {weather.temperature}°F · {weather.description}
            </Text>
          </View>
        ) : null}
        {clinic.distanceMiles != null ? (
          <View style={styles.metaRow}>
            <Navigation size={13} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {clinic.distanceMiles.toFixed(1)} mi away
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.spots, { color: isFull ? Colors.negative : spotsColor }]}>
          {isFull
            ? 'Clinic full'
            : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
        </Text>
        <TouchableOpacity
          style={[styles.viewBtn, isFull && styles.viewBtnFull]}
          onPress={onPress}
          activeOpacity={0.8}>
          <Text style={[styles.viewBtnText, isFull && styles.viewBtnTextFull]}>
            View Clinic
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ClinicCardSkeleton() {
  return (
    <View style={[styles.card, { backgroundColor: Colors.cardBg, borderColor: Colors.border }]}>
      <View style={{ height: 18, width: '65%', backgroundColor: Colors.surface2, borderRadius: 4, marginBottom: 8 }} />
      <View style={{ height: 14, width: '45%', backgroundColor: Colors.surface2, borderRadius: 4, marginBottom: 16 }} />
      <View style={{ height: 14, width: '80%', backgroundColor: Colors.surface2, borderRadius: 4, marginBottom: 6 }} />
      <View style={{ height: 14, width: '60%', backgroundColor: Colors.surface2, borderRadius: 4, marginBottom: 6 }} />
      <View style={{ height: 14, width: '70%', backgroundColor: Colors.surface2, borderRadius: 4, marginBottom: 20 }} />
      <View style={{ height: 38, backgroundColor: Colors.surface2, borderRadius: Radius.button }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.cardTitle,
    letterSpacing: -0.3,
  },
  coach: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    marginTop: 3,
  },
  agePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(45,107,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(45,107,255,0.3)',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  agePillText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 10,
    color: Colors.blue,
    letterSpacing: 0.5,
  },
  metaGrid: { gap: 7 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  spots: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: Colors.blue,
    borderRadius: Radius.button,
  },
  viewBtnFull: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  viewBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.white,
  },
  viewBtnTextFull: {
    color: Colors.fg3,
  },
});
