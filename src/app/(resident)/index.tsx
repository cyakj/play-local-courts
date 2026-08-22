import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertTriangle, X, MapPin, Swords, GraduationCap, Calendar,
  ChevronRight, Sun, Cloud, CloudRain, CloudSnow, Zap, Wrench,
} from 'lucide-react-native';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useUpcomingMatches } from '@/hooks/useUpcomingMatches';
import { useCommunityName } from '@/hooks/useCommunityName';
import { isCommunityMode, isTennisMode } from '@/config/productMode';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NextBooking {
  id: string;
  courtName: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface PendingChallenge {
  id: string;
  challengerName: string;
  matchType: string;
  date: string | null;
  timeStart: string | null;
}

interface UpcomingMatch {
  id: string;
  opponentName: string;
  matchType: string;
  date: string | null;
  timeStart: string | null;
}

interface RecentResult {
  id: string;
  opponentName: string;
  isWin: boolean;
  score: string | null;
  date: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  location: string | null;
}

interface MaintenanceNotice {
  id: string;
  amenityName: string;
  date: string;
  description: string | null;
}

interface CancelledBooking {
  id: string;
  amenityName: string;
  date: string;
  start_time: string;
}

interface WeatherData {
  tempF: number;
  rainPct: number;
  weatherCode: number;
}

// ─── Weather Helpers ──────────────────────────────────────────────────────────

type PlayabilityLevel = 'prime' | 'good' | 'caution' | 'rain' | 'storm';

interface Playability {
  level: PlayabilityLevel;
  verdict: string;      // primary — tennis-first
  conditions: string;   // secondary — weather data
  accentColor: string;
  icon: 'sun' | 'cloud' | 'rain' | 'storm';
}

function getPlayability(data: WeatherData): Playability {
  const { tempF, rainPct, weatherCode } = data;
  // WMO codes: 0-2 clear, 3 overcast, 45-48 fog, 51-67 drizzle/rain, 71-77 snow, 80-86 showers, 95-99 storm
  if (weatherCode >= 95) {
    return { level: 'storm', verdict: 'Postpone Play', conditions: `${tempF}°F · Storm in area`, accentColor: Colors.negative, icon: 'storm' };
  }
  if (weatherCode >= 51 || rainPct >= 60) {
    return { level: 'rain', verdict: 'Indoor Play Recommended', conditions: `${tempF}°F · ${rainPct}% Rain Next 3 Hours`, accentColor: Colors.negative, icon: 'rain' };
  }
  if (weatherCode >= 45 || rainPct >= 40) {
    return { level: 'caution', verdict: 'Playable with Caution', conditions: `${tempF}°F · ${rainPct}% Rain Risk`, accentColor: Colors.volt, icon: 'cloud' };
  }
  if (weatherCode === 3 || rainPct >= 20) {
    return { level: 'good', verdict: 'Good Conditions', conditions: `${tempF}°F · ${rainPct}% Rain Next 3 Hours`, accentColor: Colors.fg2, icon: 'cloud' };
  }
  return { level: 'prime', verdict: 'Prime Playing Conditions', conditions: `${tempF}°F · ${rainPct}% Rain Next 3 Hours`, accentColor: Colors.cyan, icon: 'sun' };
}

function WeatherIcon({ type, color, size }: { type: 'sun' | 'cloud' | 'rain' | 'storm'; color: string; size: number }) {
  if (type === 'sun') return <Sun color={color} size={size} strokeWidth={1.5} />;
  if (type === 'rain') return <CloudRain color={color} size={size} strokeWidth={1.5} />;
  if (type === 'storm') return <Zap color={color} size={size} strokeWidth={1.5} />;
  return <Cloud color={color} size={size} strokeWidth={1.5} />;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&hourly=precipitation_probability&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const tempF = Math.round(json.current?.temperature_2m ?? 72);
    const weatherCode = json.current?.weathercode ?? 0;
    // Average rain probability for next 3 hours
    const hourlyProb: number[] = json.hourly?.precipitation_probability ?? [];
    const nowHour = new Date().getHours();
    const next3 = hourlyProb.slice(nowHour, nowHour + 3);
    const rainPct = next3.length > 0 ? Math.round(next3.reduce((a, b) => a + b, 0) / next3.length) : 0;
    return { tempF, rainPct, weatherCode };
  } catch {
    return null;
  }
}

// ─── Other Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(t: string): string {
  const [h] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:00 ${suffix}`;
}

function firstName(fullName: string): string {
  return fullName.trim().split(' ')[0] ?? 'there';
}

function formatEventDateTime(startsAt: string): string {
  const d = new Date(startsAt);
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const communityName = useCommunityName();
  const [name, setName] = useState('');
  const [nextBooking, setNextBooking] = useState<NextBooking | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [recentResult, setRecentResult] = useState<RecentResult | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceNotice[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<CancelledBooking[]>([]);
  const [dismissedCancellations, setDismissedCancellations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const { upcoming: openMatches, invitations: matchInvites } = useUpcomingMatches(isTennisMode ? userId : '');

  useEffect(() => {
    if (!isTennisMode) { setWeatherLoading(false); return; }
    async function loadWeather() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setWeatherLoading(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const data = await fetchWeather(loc.coords.latitude, loc.coords.longitude);
        setWeather(data);
      } catch {
        // silently fail — weather is optional
      } finally {
        setWeatherLoading(false);
      }
    }
    loadWeather();
  }, []);

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setLoading(false); return; }

      const userId = user.id;
      setUserId(userId);
      const today = new Date().toISOString().split('T')[0];

      const [profileRes, membershipRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).single(),
        supabase.from('hoa_memberships').select('hoa_id').eq('user_id', userId).eq('status', 'approved').limit(1).single(),
      ]);

      setName(firstName(profileRes.data?.full_name ?? 'there'));

      const hId = membershipRes.data?.hoa_id ?? '';

      const [bookingsRes, announcementsRes, cancelledRes, challengeRes, upcomingRes, resultRes, eventsRes, courtsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, date, start_time, end_time, courts(name)')
          .eq('user_id', userId)
          .gte('date', today)
          .neq('status', 'cancelled')
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(1),

        hId ? supabase
          .from('hoa_announcements')
          .select('id, title, body, created_at')
          .eq('hoa_id', hId)
          .order('created_at', { ascending: false })
          .limit(2) : Promise.resolve({ data: [] }),

        supabase
          .from('bookings')
          .select('id, date, start_time, courts(name)')
          .eq('user_id', userId)
          .eq('status', 'cancelled')
          .eq('cancelled_by', 'admin')
          .gte('updated_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),

        isTennisMode ? supabase
          .from('match_requests')
          .select('id, match_type, date, time_start, challenger_id')
          .eq('opponent_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1) : Promise.resolve({ data: [] }),

        isTennisMode ? supabase
          .from('match_requests')
          .select('id, match_type, date, time_start, challenger_id, opponent_id')
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .eq('status', 'accepted')
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(3) : Promise.resolve({ data: [] }),

        isTennisMode ? supabase
          .from('matches')
          .select('id, date, score, winner_id, match_type, player1_id, player2_id')
          .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
          .not('winner_id', 'is', null)
          .order('date', { ascending: false })
          .limit(1) : Promise.resolve({ data: [] }),

        isCommunityMode && hId ? supabase
          .from('hoa_events')
          .select('id, title, event_type, starts_at, location')
          .eq('hoa_id', hId)
          .eq('status', 'approved')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(3) : Promise.resolve({ data: [] }),

        isCommunityMode && hId ? supabase
          .from('courts')
          .select('id')
          .eq('hoa_id', hId) : Promise.resolve({ data: [] }),
      ]);

      const firstBooking = (bookingsRes.data ?? [])[0];
      setNextBooking(firstBooking ? {
        id: firstBooking.id,
        courtName: (firstBooking as any).courts?.name ?? 'Court',
        date: firstBooking.date,
        start_time: firstBooking.start_time,
        end_time: firstBooking.end_time,
      } : null);

      setAnnouncements((announcementsRes.data ?? []) as Announcement[]);

      setUpcomingEvents(
        (eventsRes.data ?? []).map((e: any) => ({
          id: e.id,
          title: e.title,
          eventType: e.event_type,
          startsAt: e.starts_at,
          location: e.location ?? null,
        }))
      );

      const hoaCourtIds = (courtsRes.data ?? []).map((c: any) => c.id);
      if (isCommunityMode && hoaCourtIds.length > 0) {
        const { data: maintenanceData } = await supabase
          .from('court_maintenance')
          .select('id, date, description, courts(name)')
          .in('court_id', hoaCourtIds)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(3);
        setUpcomingMaintenance(
          (maintenanceData ?? []).map((m: any) => ({
            id: m.id,
            amenityName: m.courts?.name ?? 'Amenity',
            date: m.date,
            description: m.description ?? null,
          }))
        );
      } else {
        setUpcomingMaintenance([]);
      }

      setCancelledBookings(
        (cancelledRes.data ?? []).map((b: any) => ({
          id: b.id,
          amenityName: b.courts?.name ?? 'Court',
          date: b.date,
          start_time: b.start_time,
        }))
      );

      const challengeRow = (challengeRes.data ?? [])[0];
      if (challengeRow) {
        const { data: challengerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', challengeRow.challenger_id)
          .single();
        setPendingChallenge({
          id: challengeRow.id,
          challengerName: firstName(challengerProfile?.full_name ?? 'Player'),
          matchType: challengeRow.match_type ?? 'singles',
          date: challengeRow.date,
          timeStart: challengeRow.time_start,
        });
      } else {
        setPendingChallenge(null);
      }

      const matchRows = (upcomingRes.data ?? []) as Array<{
        id: string; match_type: string | null; date: string | null;
        time_start: string | null; challenger_id: string; opponent_id: string;
      }>;
      if (matchRows.length > 0) {
        const opponentIds = matchRows.map(m =>
          m.challenger_id === userId ? m.opponent_id : m.challenger_id
        );
        const { data: opponentProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', opponentIds);
        const nameMap: Record<string, string> = {};
        (opponentProfiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? 'Player'; });

        setUpcomingMatches(matchRows.map(m => ({
          id: m.id,
          opponentName: firstName(nameMap[m.challenger_id === userId ? m.opponent_id : m.challenger_id] ?? 'Player'),
          matchType: m.match_type ?? 'singles',
          date: m.date,
          timeStart: m.time_start,
        })));
      } else {
        setUpcomingMatches([]);
      }

      const resultRow = (resultRes.data ?? [])[0];
      if (resultRow) {
        const opponentId = resultRow.player1_id === userId ? resultRow.player2_id : resultRow.player1_id;
        const { data: oppProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', opponentId)
          .single();
        setRecentResult({
          id: resultRow.id,
          opponentName: firstName(oppProfile?.full_name ?? 'Player'),
          isWin: resultRow.winner_id === userId,
          score: resultRow.score,
          date: resultRow.date,
        });
      } else {
        setRecentResult(null);
      }

    } catch {
      // silently fail — show empty states
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const playability = weather ? getPlayability(weather) : null;

  return (
    <View testID="home-screen" style={styles.screen}>
      <Header variant="resident" communityName={communityName} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} />
        }
        showsVerticalScrollIndicator={false}>

        {/* ── Hero (scrolls away) ─────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTag}>WELCOME BACK</Text>
          <Text testID="greeting-name" style={styles.firstName}>{name}</Text>
        </View>

        <View style={styles.cardsContainer}>

          {/* ── Weather Intelligence ────────────────────────────────────── */}
          {isTennisMode && (
            weatherLoading ? (
              <View testID="weather-skeleton" style={styles.weatherSkeleton} />
            ) : playability ? (
              <View
                testID="weather-module"
                style={[styles.weatherModule, { borderLeftColor: playability.accentColor }]}>
                <WeatherIcon type={playability.icon} color={playability.accentColor} size={28} />
                <View style={styles.weatherText}>
                  <Text style={styles.weatherEyebrow}>CONDITIONS NOW</Text>
                  <Text style={[styles.weatherDataLine, { color: playability.accentColor }]}>
                    {playability.conditions}
                  </Text>
                </View>
              </View>
            ) : null
          )}

          {/* ── Admin cancellation banners ──────────────────────────────── */}
          {cancelledBookings
            .filter(cb => !dismissedCancellations.has(cb.id))
            .map(cb => (
              <View key={cb.id} style={styles.cancelBanner}>
                <AlertTriangle color={Colors.negative} size={20} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cancelBannerText}>
                    Your {cb.amenityName} booking on {formatDate(cb.date)} at {formatTime(cb.start_time)} was cancelled by admin.
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(resident)/courts')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.cancelBannerLink}>Book Again →</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setDismissedCancellations(prev => new Set(prev).add(cb.id))}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X color={Colors.fg3} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            ))}

          {/* ── Quick Actions ───────────────────────────────────────────── */}
          <View testID="quick-actions" style={styles.quickActionsRow}>
            <TouchableOpacity
              testID="quick-book-court"
              style={styles.quickAction}
              onPress={() => router.push('/(resident)/courts')}
              activeOpacity={0.75}>
              <MapPin color={theme.cyanOnLight} size={26} strokeWidth={1.5} />
              <Text style={styles.quickActionLabel}>{isCommunityMode ? 'Reserve' : 'Book Court'}</Text>
            </TouchableOpacity>
            {isCommunityMode ? (
              <TouchableOpacity
                testID="quick-report-issue"
                style={styles.quickAction}
                onPress={() => router.push('/(resident)/report')}
                activeOpacity={0.75}>
                <Wrench color={theme.cyanOnLight} size={26} strokeWidth={1.5} />
                <Text style={styles.quickActionLabel}>Report Issue</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  testID="quick-find-match"
                  style={styles.quickAction}
                  onPress={() => router.push('/(resident)/match')}
                  activeOpacity={0.75}>
                  <Swords color={theme.cyanOnLight} size={26} strokeWidth={1.5} />
                  <Text style={styles.quickActionLabel}>Find Match</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="quick-find-coach"
                  style={styles.quickAction}
                  onPress={() => router.push('/(resident)/coaches')}
                  activeOpacity={0.75}>
                  <GraduationCap color={theme.cyanOnLight} size={26} strokeWidth={1.5} />
                  <Text style={styles.quickActionLabel}>Find Coach</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Pending Challenge (hidden if none) ─────────────────────── */}
          {isTennisMode && pendingChallenge && (
            <View testID="pending-challenge-card" style={[styles.card, styles.challengeCard]}>
              <View style={styles.cardHeader}>
                <Swords color={Colors.negative} size={20} strokeWidth={1.5} />
                <Text style={[styles.cardTitle, { color: Colors.negative, flex: 1, marginLeft: 8 }]}>
                  Challenge from {pendingChallenge.challengerName}
                </Text>
              </View>
              <Text style={styles.challengeDetail}>
                {pendingChallenge.matchType === 'doubles' ? 'Doubles' : 'Singles'}
                {pendingChallenge.date ? ` · ${formatDate(pendingChallenge.date)}` : ''}
                {pendingChallenge.timeStart ? ` · ${formatTime(pendingChallenge.timeStart)}` : ''}
              </Text>
              <View style={styles.challengeActions}>
                <TouchableOpacity
                  testID="challenge-accept-btn"
                  style={styles.acceptBtn}
                  onPress={() => router.push('/(resident)/match')}
                  activeOpacity={0.8}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="challenge-decline-btn"
                  style={styles.declineBtn}
                  onPress={() => router.push('/(resident)/match')}
                  activeOpacity={0.8}>
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── My Next Court ───────────────────────────────────────────── */}
          {isTennisMode && (
            <View testID="next-court-card" style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.metadataLabel}>ON THE COURT</Text>
                {nextBooking && (
                  <TouchableOpacity onPress={() => router.push('/my-reservations')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.viewAllLink}>View All →</Text>
                  </TouchableOpacity>
                )}
              </View>
              {loading ? (
                <View style={styles.skeletonLine} />
              ) : nextBooking ? (
                <TouchableOpacity
                  style={styles.nextCourtRow}
                  testID="next-court-row"
                  onPress={() => router.push('/my-reservations')}
                  activeOpacity={0.7}>
                  <View style={styles.cyanDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextCourtName}>{nextBooking.courtName}</Text>
                    <Text style={styles.nextCourtTime}>
                      {formatDate(nextBooking.date)} · {formatTime(nextBooking.start_time)} – {formatTime(nextBooking.end_time)}
                    </Text>
                  </View>
                  <ChevronRight color={Colors.fg3} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyState}>
                  <Calendar color={Colors.fg3} size={52} strokeWidth={1.5} />
                  <Text style={styles.emptyTitle}>No upcoming reservations</Text>
                  <Text style={styles.emptySubtitle}>Reserve a court to get on the court today.</Text>
                  <TouchableOpacity
                    testID="book-court-cta"
                    style={styles.primaryCta}
                    onPress={() => router.push('/(resident)/courts')}
                    activeOpacity={0.8}>
                    <Text style={styles.primaryCtaText}>Book a Court</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Upcoming Reservation (Community mode) ───────────────────── */}
          {isCommunityMode && (
            <View testID="upcoming-reservation-card" style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.metadataLabel}>UPCOMING RESERVATION</Text>
                {nextBooking && (
                  <TouchableOpacity onPress={() => router.push('/my-reservations')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.viewAllLink}>View All →</Text>
                  </TouchableOpacity>
                )}
              </View>
              {loading ? (
                <View style={styles.skeletonLine} />
              ) : nextBooking ? (
                <TouchableOpacity
                  style={styles.nextCourtRow}
                  testID="upcoming-reservation-row"
                  onPress={() => router.push('/my-reservations')}
                  activeOpacity={0.7}>
                  <View style={styles.cyanDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextCourtName}>{nextBooking.courtName}</Text>
                    <Text style={styles.nextCourtTime}>
                      {formatDate(nextBooking.date)} · {formatTime(nextBooking.start_time)} – {formatTime(nextBooking.end_time)}
                    </Text>
                  </View>
                  <ChevronRight color={Colors.fg3} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyState}>
                  <Calendar color={Colors.fg3} size={52} strokeWidth={1.5} />
                  <Text style={styles.emptyTitle}>No upcoming reservations</Text>
                  <Text style={styles.emptySubtitle}>Reserve an amenity to see it here.</Text>
                  <TouchableOpacity
                    testID="reserve-cta"
                    style={styles.primaryCta}
                    onPress={() => router.push('/(resident)/courts')}
                    activeOpacity={0.8}>
                    <Text style={styles.primaryCtaText}>Reserve Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Match Invitations teaser (hidden if none) ───────────────── */}
          {isTennisMode && !loading && matchInvites.length > 0 && (
            <TouchableOpacity
              testID="match-invites-banner"
              style={styles.inviteBanner}
              onPress={() => router.push('/(resident)/match')}
              activeOpacity={0.8}>
              <Swords color={Colors.blue} size={18} strokeWidth={1.5} />
              <Text style={styles.inviteBannerText}>
                {matchInvites.length} match invitation{matchInvites.length > 1 ? 's' : ''} waiting
              </Text>
              <ChevronRight color={Colors.blue} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          )}

          {/* ── Upcoming Matches (hidden if empty) ─────────────────────── */}
          {isTennisMode && !loading && (upcomingMatches.length > 0 || openMatches.length > 0) && (
            <View testID="upcoming-matches-card" style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.metadataLabel}>UPCOMING MATCHES</Text>
                <TouchableOpacity onPress={() => router.push('/(resident)/match')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.viewAllLink}>All →</Text>
                </TouchableOpacity>
              </View>
              {upcomingMatches.map((m, i) => (
                <TouchableOpacity
                  key={m.id}
                  testID="upcoming-match-row"
                  style={[styles.listRow, (i < upcomingMatches.length - 1 || openMatches.length > 0) && styles.listRowBorder]}
                  onPress={() => router.push('/(resident)/match')}
                  activeOpacity={0.7}>
                  <View style={styles.cyanDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>vs {m.opponentName}</Text>
                    <Text style={styles.rowSub}>
                      {m.matchType === 'doubles' ? 'Doubles' : 'Singles'}
                      {m.date ? ` · ${formatDate(m.date)}` : ''}
                      {m.timeStart ? ` · ${formatTime(m.timeStart)}` : ''}
                    </Text>
                  </View>
                  <ChevronRight color={Colors.fg3} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              ))}
              {openMatches.map((m, i) => (
                <TouchableOpacity
                  key={m.listingId}
                  testID="upcoming-open-match-row"
                  style={[styles.listRow, i < openMatches.length - 1 && styles.listRowBorder]}
                  onPress={() => router.push(`/match/${m.listingId}` as any)}
                  activeOpacity={0.7}>
                  <View style={styles.cyanDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{m.format === 'doubles' ? 'Doubles' : 'Singles'} · {m.location}</Text>
                    <Text style={styles.rowSub}>
                      {formatDate(m.matchDate)} · {formatTime(m.startTime)}
                      {m.role === 'organizer' && m.openSlots > 0 ? ` · ${m.openSlots} open` : ''}
                    </Text>
                  </View>
                  <ChevronRight color={Colors.fg3} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Recent Result (hidden if none) ─────────────────────────── */}
          {isTennisMode && !loading && recentResult && (
            <View testID="recent-result-card" style={styles.card}>
              <Text style={styles.metadataLabel}>LAST RESULT</Text>
              <View style={[styles.listRow, { paddingTop: 10 }]}>
                <View style={[
                  styles.resultPill,
                  { backgroundColor: recentResult.isWin ? 'rgba(47,217,139,0.15)' : 'rgba(255,92,107,0.15)' },
                ]}>
                  <Text style={[
                    styles.resultPillText,
                    { color: recentResult.isWin ? Colors.positive : Colors.negative },
                  ]}>
                    {recentResult.isWin ? 'WIN' : 'LOSS'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.rowTitle}>vs {recentResult.opponentName}</Text>
                  <Text style={styles.rowSub}>
                    {recentResult.score ? `${recentResult.score} · ` : ''}{formatDate(recentResult.date)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Community Pulse (max 2 — hidden if empty) ──────────────── */}
          {!loading && announcements.length > 0 && (
            <View testID="community-pulse-card" style={styles.pulseCard}>
              <Text testID="community-pulse-label" style={styles.pulseLabel}>COMMUNITY PULSE</Text>
              {announcements.map((a, i) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.listRow, i < announcements.length - 1 && styles.listRowBorder]}
                  onPress={() => router.push('/announcements')}
                  activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pulseTitle} numberOfLines={2}>{a.title}</Text>
                  </View>
                  <ChevronRight color={Colors.fg3} size={16} strokeWidth={1.5} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Upcoming Community Events (Community mode, hidden if empty) ── */}
          {isCommunityMode && !loading && upcomingEvents.length > 0 && (
            <View testID="upcoming-events-card" style={styles.pulseCard}>
              <Text testID="upcoming-events-label" style={styles.pulseLabel}>UPCOMING EVENTS</Text>
              {upcomingEvents.map((e, i) => (
                <TouchableOpacity
                  key={e.id}
                  testID="upcoming-event-row"
                  style={[styles.listRow, i < upcomingEvents.length - 1 && styles.listRowBorder]}
                  onPress={() => router.push('/(resident)/calendar')}
                  activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pulseTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.rowSub}>
                      {formatEventDateTime(e.startsAt)}{e.location ? ` · ${e.location}` : ''}
                    </Text>
                  </View>
                  <View style={styles.eventTypeBadge}>
                    <Text style={styles.eventTypeBadgeText}>{e.eventType.replace(/_/g, ' ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Maintenance Notice (Community mode, hidden if empty) ───── */}
          {isCommunityMode && !loading && upcomingMaintenance.length > 0 && (
            <View testID="maintenance-notice-banner" style={styles.maintenanceBanner}>
              <View style={styles.maintenanceBannerHeader}>
                <Wrench color={Colors.volt} size={16} strokeWidth={1.5} />
                <Text style={styles.maintenanceBannerLabel}>MAINTENANCE NOTICE</Text>
              </View>
              {upcomingMaintenance.map((m) => (
                <Text key={m.id} testID="maintenance-notice-row" style={styles.maintenanceBannerText}>
                  {m.amenityName} closed {formatDate(m.date)}{m.description ? `: ${m.description}` : ''}
                </Text>
              ))}
            </View>
          )}

          {/* ── View Full Schedule ──────────────────────────────────────── */}
          <TouchableOpacity
            testID="calendar-link"
            style={styles.calendarLink}
            onPress={() => router.push('/(resident)/calendar')}
            activeOpacity={0.7}>
            <Calendar color={theme.cyanOnLight} size={20} strokeWidth={1.5} />
            <Text style={styles.calendarLinkText}>View full schedule</Text>
            <ChevronRight color={Colors.fg2} size={18} strokeWidth={1.5} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    body: { paddingBottom: 108 },

    hero: {
      backgroundColor: theme.heroBg,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 8,
      paddingBottom: 14,
    },
    welcomeTag: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.cyanOnLight,
      letterSpacing: 2.2,
      marginBottom: 4,
    },
    firstName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.pageTitle,
      color: theme.textPrimary,
      lineHeight: 38,
      letterSpacing: -0.5,
      marginBottom: 0,
    },

    cardsContainer: {
      maxWidth: MaxWidth,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 16,
      gap: Spacing.cardGap,
    },

    weatherModule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 3,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    weatherText: { flex: 1 },
    weatherEyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.8,
      marginBottom: 4,
    },
    weatherDataLine: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 17,
      letterSpacing: -0.2,
      lineHeight: 22,
    },
    weatherSkeleton: {
      height: 48,
      backgroundColor: theme.surface2,
      borderRadius: Radius.sm,
    },

    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: Spacing.cardPadding,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowElevated,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    metadataLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.8,
      flex: 1,
    },
    viewAllLink: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
    },

    quickActionsRow: { flexDirection: 'row', gap: 12 },
    quickAction: {
      flex: 1,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      minHeight: Spacing.quickActionHeight,
      gap: 8,
      ...theme.shadowCard,
    },
    quickActionLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
      textAlign: 'center',
    },

    challengeCard: { borderLeftWidth: 3, borderLeftColor: Colors.negative },
    challengeDetail: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      marginBottom: 14,
    },
    challengeActions: { flexDirection: 'row', gap: 12 },
    acceptBtn: {
      flex: 1,
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: Spacing.tapTarget,
    },
    acceptBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
    declineBtn: {
      flex: 1,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: Spacing.tapTarget,
    },
    declineBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },

    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      minHeight: Spacing.listRowHeight,
    },
    listRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
    cyanDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.cyanOnLight, flexShrink: 0 },
    rowTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    rowSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      marginTop: 2,
    },

    nextCourtRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingTop: 4,
      minHeight: Spacing.listRowHeight,
    },
    nextCourtName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    nextCourtTime: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      marginTop: 2,
    },

    resultPill: {
      borderRadius: Radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 5,
      alignSelf: 'center',
      flexShrink: 0,
    },
    resultPillText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      letterSpacing: 0.8,
    },

    pulseCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.cardPadding,
      paddingTop: 14,
      paddingBottom: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pulseLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.8,
      marginBottom: 8,
    },
    pulseTitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },

    eventTypeBadge: {
      backgroundColor: theme.surface2,
      borderRadius: Radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      flexShrink: 0,
    },
    eventTypeBadgeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      letterSpacing: 0.8,
      color: theme.textMuted,
      textTransform: 'uppercase',
    },

    calendarLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: Spacing.listRowHeight,
    },
    calendarLinkText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textSecondary,
    },

    emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      marginTop: 8,
    },
    emptySubtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    primaryCta: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingHorizontal: 24,
      minHeight: Spacing.tapTarget + 4,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    primaryCtaText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },

    cancelBanner: {
      backgroundColor: 'rgba(255,92,107,0.10)',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: Colors.negative,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    cancelBannerText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
      lineHeight: 20,
    },
    cancelBannerLink: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
      marginTop: 6,
    },

    inviteBanner: {
      backgroundColor: 'rgba(45,107,255,0.10)',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: Colors.blue,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    inviteBannerText: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
    },

    maintenanceBanner: {
      backgroundColor: 'rgba(214,255,61,0.08)',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: Colors.volt,
      padding: 14,
    },
    maintenanceBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    maintenanceBannerLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.volt,
      letterSpacing: 1.8,
    },
    maintenanceBannerText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
      marginTop: 4,
    },

    skeletonLine: {
      height: 44,
      backgroundColor: theme.surface2,
      borderRadius: Radius.sm,
    },
  }), [theme]);
}
