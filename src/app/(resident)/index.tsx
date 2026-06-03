import { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Cloud, CloudLightning, CloudRain, Sun } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { CardSkeleton } from '@/components/ui/Skeleton';

// ─── Weather ──────────────────────────────────────────────────────

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';

interface CurrentWeather {
  temp: number;
  condition: WeatherCondition;
  description: string;
  rainPct: number;
}

function mapWmoCode(code: number): WeatherCondition {
  if (code <= 1) return 'sunny';
  if (code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'cloudy';
  if (code >= 51 && code <= 82) return 'rainy';
  if (code >= 95) return 'stormy';
  return 'cloudy';
}

function conditionLabel(c: WeatherCondition): string {
  switch (c) {
    case 'sunny': return 'Clear';
    case 'partly_cloudy': return 'Partly Cloudy';
    case 'cloudy': return 'Overcast';
    case 'rainy': return 'Rain';
    case 'stormy': return 'Thunderstorm';
  }
}

function WeatherIcon({ condition, size = 28 }: { condition: WeatherCondition; size?: number }) {
  switch (condition) {
    case 'sunny':
      return <Sun color={Colors.accentCyan} size={size} strokeWidth={1.5} />;
    case 'partly_cloudy':
      return <Cloud color={Colors.textMuted} size={size} strokeWidth={1.5} />;
    case 'rainy':
      return <CloudRain color='#5BB8E0' size={size} strokeWidth={1.5} />;
    case 'stormy':
      return <CloudLightning color={Colors.coral} size={size} strokeWidth={1.5} />;
    default:
      return <Cloud color={Colors.textMuted} size={size} strokeWidth={1.5} />;
  }
}

async function fetchCurrentWeather(): Promise<CurrentWeather | null> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=18.4655&longitude=-66.1057' +
      '&current=temperature_2m,weather_code,precipitation_probability' +
      '&timezone=America%2FPuerto_Rico&temperature_unit=fahrenheit'
    );
    if (!res.ok) return null;
    const data = await res.json();
    const condition = mapWmoCode(data.current.weather_code);
    return {
      temp: Math.round(data.current.temperature_2m),
      condition,
      description: conditionLabel(condition),
      rainPct: data.current.precipitation_probability ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now.getTime() + 86400000);
  if (d.getTime() === now.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────

interface UpcomingBooking {
  id: string;
  courtName: string;
  date: string;
  start_time: string;
  end_time: string;
}

// ─── Screen ───────────────────────────────────────────────────────

export default function ResidentHomeScreen() {
  const [userName, setUserName] = useState('');
  const [avatarInitials, setAvatarInitials] = useState('U');
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, weatherData] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      fetchCurrentWeather(),
    ]);

    if (profileRes.data?.full_name) {
      setUserName(profileRes.data.full_name);
      setAvatarInitials(getInitials(profileRes.data.full_name));
    }
    setWeather(weatherData);

    const today = new Date().toISOString().split('T')[0];
    const { data: upcoming } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, courts(name)')
      .eq('user_id', user.id)
      .gte('date', today)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5);

    setUpcomingBookings(
      (upcoming ?? []).map((b: any) => ({
        id: b.id,
        courtName: b.courts?.name ?? 'Court',
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="resident-home"
        greeting={`Hey${userName ? ', ' + userName.split(' ')[0] : ''}!`}
        subCopy="Ready to play?"
        avatarInitials={avatarInitials}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />
        }
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Weather Banner */}
          {weather && (
            <Card style={styles.weatherCard}>
              <View style={styles.weatherRow}>
                <View style={styles.weatherIconWrap}>
                  <WeatherIcon condition={weather.condition} size={32} />
                </View>
                <View style={styles.weatherCenter}>
                  <Text style={styles.weatherTemp}>{weather.temp}°F</Text>
                  <Text style={styles.weatherDesc}>{weather.description}</Text>
                </View>
                {weather.rainPct > 0 && (
                  <View style={styles.weatherRight}>
                    <Text style={styles.weatherRainPct}>{weather.rainPct}%</Text>
                    <Text style={styles.weatherRainLabel}>rain</Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Upcoming Reservations */}
          <Text style={styles.sectionTitle}>Upcoming Reservations</Text>
          {loading ? (
            <CardSkeleton />
          ) : upcomingBookings.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming reservations.</Text>
          ) : (
            upcomingBookings.map((b) => (
              <Card key={b.id} style={styles.bookingCard}>
                <Text style={styles.bookingCourt}>{b.courtName}</Text>
                <Text style={styles.bookingTime}>
                  {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 100 },

  weatherCard: {
    marginBottom: Spacing.sectionGap,
    padding: 16,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherIconWrap: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherCenter: {
    flex: 1,
    paddingLeft: 8,
  },
  weatherTemp: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 28,
    color: Colors.navy,
    lineHeight: 32,
  },
  weatherDesc: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
    marginTop: 2,
  },
  weatherRight: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  weatherRainPct: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 18,
    color: Colors.textSubtle,
  },
  weatherRainLabel: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  sectionTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    marginBottom: 8,
  },
  bookingCard: { marginBottom: Spacing.cardGap, padding: 16, gap: 4 },
  bookingCourt: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  bookingTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
  },
  emptyText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
  },
});
