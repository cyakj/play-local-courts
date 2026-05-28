import { useCallback, useEffect, useState } from 'react';
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
  AlertTriangle, BarChart2, Calendar, CalendarDays, Building2, Megaphone, X,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpcomingBooking {
  id: string;
  courtName: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  href?: string;
}

function mergeAnnouncementFeed(
  announcementRows: Announcement[],
  closedSurveyRows: { id: string; title: string; created_at: string; closes_at: string | null }[]
): Announcement[] {
  return [
    ...announcementRows,
    ...closedSurveyRows.map((survey) => ({
      id: `survey-results-${survey.id}`,
      title: `Survey Results: ${survey.title}`,
      body: `Results are now available for "${survey.title}" — tap to view the community results.`,
      created_at: survey.closes_at ?? survey.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

interface HoaEvent {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
}

interface OpenReport {
  id: string;
  title: string | null;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

interface CancelledBooking {
  id: string;
  amenityName: string;
  date: string;
  start_time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResidentHomeScreen() {
  const [firstName, setFirstName] = useState('');
  const [hoaName, setHoaName] = useState('');
  const [hoaId, setHoaId] = useState('');
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<HoaEvent[]>([]);
  const [openReports, setOpenReports] = useState<OpenReport[]>([]);
  const [openReportsCount, setOpenReportsCount] = useState(0);
  const [cancelledBookings, setCancelledBookings] = useState<CancelledBooking[]>([]);
  const [dismissedCancellations, setDismissedCancellations] = useState<Set<string>>(new Set());
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) { setLoading(false); return; }

    const [profileRes, membershipRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved').limit(1).single(),
    ]);

    const fname = profileRes.data?.full_name?.split(' ')[0] ?? 'there';
    setFirstName(fname);

    const hId = membershipRes.data?.hoa_id ?? '';
    setHoaId(hId);

    if (hId) {
      const [hoaRes, bookingsRes, announcementsRes, closedSurveysRes, eventsRes, reportsRes] = await Promise.all([
        supabase.from('hoas').select('name').eq('id', hId).single(),
        supabase
          .from('bookings')
          .select('id, date, start_time, end_time, courts(name)')
          .eq('user_id', user.id)
          .gte('date', new Date().toISOString().split('T')[0])
          .neq('status', 'cancelled')
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(3),
        supabase
          .from('hoa_announcements')
          .select('id, title, body, created_at')
          .eq('hoa_id', hId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('hoa_surveys')
          .select('id, title, created_at, closes_at')
          .eq('hoa_id', hId)
          .eq('status', 'closed')
          .eq('results_visibility', 'community')
          .order('closes_at', { ascending: false })
          .limit(10),
        supabase
          .from('hoa_events')
          .select('id, title, starts_at, location')
          .eq('hoa_id', hId)
          .eq('status', 'active')
          .eq('event_type', 'community_event')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at')
          .limit(3),
        supabase
          .from('maintenance_reports')
          .select('id, title, category, description, status, created_at', { count: 'exact' })
          .eq('reporter_id', user.id)
          .eq('hoa_id', hId)
          .in('status', ['open', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      setHoaName(hoaRes.data?.name ?? '');

      setUpcomingBookings(
        (bookingsRes.data ?? []).map((b: any) => ({
          id: b.id,
          courtName: b.courts?.name ?? 'Court',
          date: b.date,
          start_time: b.start_time,
          end_time: b.end_time,
        }))
      );

      setAnnouncements(
        mergeAnnouncementFeed(
          (announcementsRes.data ?? []) as Announcement[],
          closedSurveysRes.data ?? []
        ).slice(0, 3)
      );

      setEvents((eventsRes.data ?? []) as HoaEvent[]);

      setOpenReports((reportsRes.data ?? []) as OpenReport[]);
      setOpenReportsCount(reportsRes.count ?? 0);
    }

    // Load admin-cancelled bookings from last 48h
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: cancelledData } = await supabase
      .from('bookings')
      .select('id, court_id, date, start_time, end_time, courts(name)')
      .eq('user_id', user.id)
      .eq('status', 'cancelled')
      .eq('cancelled_by', 'admin')
      .gte('updated_at', cutoff);

    setCancelledBookings(
      (cancelledData ?? []).map((b: any) => ({
        id: b.id,
        amenityName: b.courts?.name ?? 'Amenity',
        date: b.date,
        start_time: b.start_time,
      }))
    );

    setLoading(false);
    } catch {
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

  const cardStyle = styles.card;

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      {/* ── Body + hero (hero scrolls away) ───────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />
        }
        showsVerticalScrollIndicator={false}>

        {/* Hero greeting — inside scroll so it scrolls away */}
        <View style={styles.hero}>
          <Text style={styles.welcomeTag}>WELCOME BACK</Text>
          <Text style={styles.greetingText}>{greeting()}</Text>
          <Text style={styles.firstName}>{firstName}</Text>
          {hoaName ? (
            <View style={styles.hoaRow}>
              <Building2 color="rgba(0,212,255,0.7)" size={14} strokeWidth={1.5} />
              <Text testID="hoa-name" style={styles.hoaName}>{hoaName}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardsContainer}>

          {/* Admin cancellation banners */}
          {cancelledBookings
            .filter((cb) => !dismissedCancellations.has(cb.id))
            .map((cb) => (
              <View key={cb.id} style={styles.cancelBanner}>
                <AlertTriangle color="#EF4444" size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cancelBannerText}>
                    Your {cb.amenityName} booking on {formatDate(cb.date)} at {formatTime(cb.start_time)} was cancelled by admin.
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(resident)/book')}>
                    <Text style={styles.cancelBannerLink}>Book Again →</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setDismissedCancellations((prev) => new Set(prev).add(cb.id))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X color="#9CA3AF" size={16} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            ))}

          {/* CARD: Upcoming Reservations */}
          <View style={cardStyle}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Upcoming Reservations</Text>
              {upcomingBookings.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/my-reservations')}>
                  <Text style={styles.viewAll}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <View style={styles.skeletonLine} />
            ) : upcomingBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar color={Colors.textMuted} size={40} strokeWidth={1.75} />
                <Text style={styles.emptyText}>No upcoming reservations</Text>
                <TouchableOpacity style={styles.ctaPill} onPress={() => router.push('/(resident)/book')}>
                  <Text style={styles.ctaPillText}>Book an Amenity</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingBookings.map((b, i) => (
                <View
                  key={b.id}
                  testID="booking-row"
                  style={[styles.listRow, i < upcomingBookings.length - 1 && styles.listRowBorder]}>
                  <View style={styles.cyanDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listRowTitle}>{b.courtName}</Text>
                    <Text style={styles.listRowSub}>
                      {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* CARD: Community Announcements */}
          <View style={cardStyle}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Community Announcements</Text>
              <TouchableOpacity
                testID="announcements-view-all"
                onPress={() => router.push('/announcements')}>
                <Text style={styles.viewAll}>View All →</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <View style={styles.skeletonLine} />
            ) : announcements.length === 0 ? (
              <View style={styles.emptyState}>
                <Megaphone color={Colors.textMuted} size={40} strokeWidth={1.75} />
                <Text style={styles.emptyText}>No announcements yet</Text>
              </View>
            ) : (
              announcements.map((a, i) => {
                const isExpanded = expandedAnnouncement === a.id;
                const isSurveyResult = a.id.startsWith('survey-results-');
                return (
                  <TouchableOpacity
                    key={a.id}
                    testID="announcement-row"
                    style={[styles.listRow, i < announcements.length - 1 && styles.listRowBorder]}
                    onPress={() => setExpandedAnnouncement(isExpanded ? null : a.id)}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listRowTitle}>{a.title}</Text>
                      <Text style={styles.listRowSub} numberOfLines={isExpanded ? undefined : 1}>
                        {a.body}
                      </Text>
                      <Text style={styles.timeAgo}>{timeAgo(a.created_at)}</Text>
                      {isSurveyResult && (
                        <TouchableOpacity
                          testID="view-results-btn"
                          style={styles.viewResultsBtn}
                          onPress={() => {
                            const surveyId = a.id.replace('survey-results-', '');
                            router.push({ pathname: '/survey-results/[id]', params: { id: surveyId } } as any);
                          }}>
                          <BarChart2 color={Colors.accentCyan} size={15} strokeWidth={1.75} />
                          <Text style={styles.viewResultsBtnText}>View Results →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* CARD: Community Events */}
          <View style={cardStyle}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Community Events</Text>
              {events.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/(resident)/calendar')}>
                  <Text style={styles.viewAll}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <View style={styles.skeletonLine} />
            ) : events.length === 0 ? (
              <View style={styles.emptyState}>
                <CalendarDays color={Colors.textMuted} size={40} strokeWidth={1.75} />
                <Text style={styles.emptyText}>No upcoming events</Text>
              </View>
            ) : (
              events.map((e, i) => {
                const dt = new Date(e.starts_at);
                return (
                  <View key={e.id} style={[styles.listRow, i < events.length - 1 && styles.listRowBorder]}>
                    <View style={styles.cyanDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listRowTitle}>{e.title}</Text>
                      <Text style={styles.listRowSub}>
                        {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {e.location ? ` · ${e.location}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* CARD: My Open Reports (only if any) */}
          {(openReportsCount > 0 || openReports.length > 0) && (
            <View style={cardStyle}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>My Open Reports</Text>
                {openReportsCount > 3 && (
                  <TouchableOpacity onPress={() => router.push('/my-reports')}>
                    <Text style={styles.viewAll}>View All →</Text>
                  </TouchableOpacity>
                )}
              </View>
              {openReports.map((r, i) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.listRow, i < openReports.length - 1 && styles.listRowBorder]}
                  onPress={() => router.push('/my-reports')}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.reportTitleRow}>
                      <Text style={[styles.listRowTitle, { flex: 1 }]} numberOfLines={1}>
                        {r.title || r.category || 'Report'}
                      </Text>
                      <View style={[
                        styles.statusPill,
                        { backgroundColor: r.status === 'open' ? '#FFF5F5' : '#E0F9FF' },
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          { color: r.status === 'open' ? '#F97066' : '#00D4FF' },
                        ]}>
                          {r.status === 'open' ? 'Open' : 'In Progress'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.timeAgo}>{timeAgo(r.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  // Hero greeting (inside ScrollView — scrolls away)
  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 8,
    paddingBottom: 28,
  },
  welcomeTag: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.accentCyan,
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  greetingText: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 32,
    color: Colors.white,
    lineHeight: 36,
  },
  firstName: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 32,
    color: Colors.white,
    lineHeight: 36,
    marginBottom: 12,
  },
  hoaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hoaName: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: 'rgba(0,212,255,0.7)',
  },
  // Body
  body: {
    paddingBottom: 100,
  },

  // Card
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 19,
    color: Colors.navy,
  },
  viewAll: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.accentCyan,
  },

  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cyanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accentCyan,
    marginTop: 3,
    flexShrink: 0,
  },
  listRowTitle: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.navy,
  },
  listRowSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  timeAgo: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  ctaPill: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  ctaPillText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.navy,
  },

  // Reports
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  statusPillText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
  },

  cancelBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  cancelBannerText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: '#EF4444',
    lineHeight: 18,
  },
  cancelBannerLink: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.accentCyan,
    marginTop: 6,
  },

  // Skeleton
  skeletonLine: {
    height: 40,
    backgroundColor: Colors.pageBg,
    borderRadius: 8,
  },

  cardsContainer: {
    maxWidth: MaxWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 20,
  },

  viewResultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  viewResultsBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.accentCyan,
  },
});
