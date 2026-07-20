import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { useUpcomingMatches } from '@/hooks/useUpcomingMatches';

// ─── Event type config — tennis-first ─────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  court_reservation: { color: Colors.cyan,     label: 'Court Reservation' },
  match_event:       { color: Colors.blue,     label: 'Match' },
  lesson:            { color: Colors.positive, label: 'Lesson' },
  club_event:        { color: Colors.volt,     label: 'Club Event' },
};

const EVENT_TYPE_FILTERS = ['All', 'Court Reservations', 'Matches', 'Lessons', 'Club Events'];
const EVENT_TYPE_FILTER_MAP: Record<string, string> = {
  'Court Reservations': 'court_reservation',
  Matches:              'match_event',
  Lessons:              'lesson',
  'Club Events':        'club_event',
};

// HOA event types that map to tennis categories (rest are hidden)
const HOA_TYPE_MAP: Record<string, string> = {
  amenity_booking:  'court_reservation',
  community_event:  'club_event',
  coaching:         'lesson',
  club_event:       'club_event',
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Community { hoaId: string; name: string; }
interface ScheduleEvent {
  id: string;
  title: string;
  event_type: string;
  location: string | null;
  starts_at: string;
  hoa_id: string;
  community_name: string;
  description: string | null;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const grid: { day: number; inMonth: boolean }[] = [];
  for (let i = mondayOffset - 1; i >= 0; i--) grid.push({ day: prevMonthDays - i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) grid.push({ day: d, inMonth: true });
  const remaining = 7 - (grid.length % 7);
  if (remaining < 7) for (let d = 1; d <= remaining; d++) grid.push({ day: d, inMonth: false });
  return grid;
}

function getWeekDates(base: Date) {
  const dow = base.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function ResidentCalendarScreen() {
  const now = new Date();
  const { theme } = useTheme();

  const [viewMode, setViewMode]           = useState<'month' | 'week'>('month');
  const [currentMonth, setCurrentMonth]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [weekBase, setWeekBase]           = useState(now);
  const [selectedDay, setSelectedDay]     = useState(now.getDate());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());

  const [communities, setCommunities]         = useState<Community[]>([]);
  const [activeCommunity, setActiveCommunity] = useState('all');
  const [activeEventType, setActiveEventType] = useState('All');
  const [events, setEvents]                   = useState<ScheduleEvent[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [detailEvent, setDetailEvent]         = useState<ScheduleEvent | null>(null);
  const [userId, setUserId]                   = useState('');
  // Match-creation (open_match_listings) matches — separate from the legacy
  // `matches` table already queried in fetchAll below; merged in filteredEvents.
  const { upcoming: openMatches } = useUpcomingMatches(userId);

  const monthGrid    = useMemo(() => buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);
  const weekDates    = useMemo(() => getWeekDates(weekBase), [weekBase]);
  const displayMonth = viewMode === 'month' ? currentMonth : (weekDates[3] || now);
  const displayMonthLabel = displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  async function fetchAll(uid: string, comms: Community[]) {
    if (comms.length === 0) { setLoading(false); return; }
    setLoading(true);
    const hoaIds = comms.map((c) => c.hoaId);
    const hoaMap = new Map(comms.map((c) => [c.hoaId, c.name]));

    const mapped: ScheduleEvent[] = [];

    // Court bookings — user's own confirmed reservations
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, court_id, courts(name, hoa_id)')
      .eq('user_id', uid)
      .eq('status', 'confirmed');

    if (bookings) {
      for (const b of bookings) {
        const court = (b as any).courts;
        if (!court || !hoaIds.includes(court.hoa_id)) continue;
        const startHour = b.start_time?.slice(0, 5) || '';
        const endHour   = b.end_time?.slice(0, 5)   || '';
        mapped.push({
          id: b.id,
          title: `${court.name} · ${fmtTime(startHour)} – ${fmtTime(endHour)}`,
          event_type: 'court_reservation',
          location: court.name,
          starts_at: `${b.date}T${b.start_time}`,
          hoa_id: court.hoa_id,
          community_name: hoaMap.get(court.hoa_id) || '',
          description: null,
        });
      }
    }

    // User's matches
    const { data: userMatches } = await supabase
      .from('matches')
      .select('id, date, time_start, time_end, location, match_type, status')
      .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
      .in('status', ['scheduled', 'reschedule_requested'])
      .order('date');

    if (userMatches) {
      for (const m of userMatches) {
        const startStr = m.time_start?.slice(0, 5) || '';
        const endStr   = m.time_end?.slice(0, 5)   || '';
        const typeLabel = m.match_type === 'doubles' ? 'Doubles Match' :
                          m.match_type === 'mixed_doubles' ? 'Mixed Doubles Match' :
                          m.match_type === 'hitting_session' ? 'Hitting Session' : 'Singles Match';
        mapped.push({
          id: `match-${m.id}`,
          title: typeLabel + (startStr ? ` · ${fmtTime(startStr)}` + (endStr ? ` – ${fmtTime(endStr)}` : '') : ''),
          event_type: 'match_event',
          location: m.location || null,
          starts_at: `${m.date}T${m.time_start || '00:00:00'}`,
          hoa_id: '',
          community_name: '',
          description: null,
        });
      }
    }

    // Confirmed lessons from lesson_requests
    const { data: lessons } = await supabase
      .from('lesson_requests')
      .select('id, preferred_date, preferred_time_start, preferred_time_end, location, lesson_type, coach_id')
      .eq('player_id', uid)
      .eq('status', 'confirmed');

    if (lessons) {
      for (const l of lessons) {
        const startStr = l.preferred_time_start?.slice(0, 5) || '';
        const endStr   = l.preferred_time_end?.slice(0, 5)   || '';
        const typeLabel = l.lesson_type
          ? l.lesson_type.charAt(0).toUpperCase() + l.lesson_type.slice(1) + ' Lesson'
          : 'Lesson';
        mapped.push({
          id: `lesson-${l.id}`,
          title: typeLabel + (startStr ? ` · ${fmtTime(startStr)}` + (endStr ? ` – ${fmtTime(endStr)}` : '') : ''),
          event_type: 'lesson',
          location: l.location || null,
          starts_at: `${l.preferred_date}T${l.preferred_time_start || '00:00:00'}`,
          hoa_id: '',
          community_name: '',
          description: null,
        });
      }
    }

    // HOA events — only tennis-relevant types
    const { data: hoaEvents } = await supabase
      .from('hoa_events')
      .select('id, title, event_type, location, starts_at, hoa_id, description')
      .in('hoa_id', hoaIds)
      .eq('status', 'approved')
      .order('starts_at');

    if (hoaEvents) {
      for (const e of hoaEvents) {
        const mappedType = HOA_TYPE_MAP[e.event_type];
        if (!mappedType) continue; // skip board_meeting, maintenance, etc.
        mapped.push({
          id: e.id,
          title: e.title,
          event_type: mappedType,
          location: e.location || null,
          starts_at: e.starts_at,
          hoa_id: e.hoa_id,
          community_name: hoaMap.get(e.hoa_id) || '',
          description: e.description || null,
        });
      }
    }

    mapped.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    setEvents(mapped);
    setLoading(false);
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) { setLoading(false); return; }
        setUserId(user.id);

        const { data: memberships } = await supabase
          .from('hoa_memberships')
          .select('hoa_id, hoas(name)')
          .eq('user_id', user.id)
          .eq('status', 'approved');

        const comms: Community[] = (memberships ?? []).map((m: any) => ({
          hoaId: m.hoa_id,
          name: m.hoas?.name || 'Community',
        }));
        setCommunities(comms);
        await fetchAll(user.id, comms);
      } catch {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('resident-schedule-bookings')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `user_id=eq.${userId}`,
      }, () => { fetchAll(userId, communities); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'matches',
      }, () => { fetchAll(userId, communities); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'lesson_requests',
        filter: `player_id=eq.${userId}`,
      }, () => { fetchAll(userId, communities); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, communities]);

  const openMatchEvents = useMemo<ScheduleEvent[]>(() => openMatches.map((m) => ({
    id: `open-match-${m.listingId}`,
    title: `${m.format === 'doubles' ? 'Doubles Match' : 'Singles Match'} · ${fmtTime(m.startTime.slice(0, 5))}`,
    event_type: 'match_event',
    location: m.location || null,
    starts_at: `${m.matchDate}T${m.startTime}`,
    hoa_id: '',
    community_name: '',
    description: m.role === 'organizer' && m.openSlots > 0 ? `${m.openSlots} open slot${m.openSlots > 1 ? 's' : ''}` : null,
  })), [openMatches]);

  const filteredEvents = useMemo(() => [...events, ...openMatchEvents].filter((e) => {
    if (activeCommunity !== 'all' && e.hoa_id !== activeCommunity) return false;
    const typeKey = EVENT_TYPE_FILTER_MAP[activeEventType];
    if (activeEventType !== 'All' && e.event_type !== typeKey) return false;
    return true;
  }), [events, openMatchEvents, activeCommunity, activeEventType]);

  function getDotsForDay(year: number, month: number, day: number) {
    const evts = filteredEvents.filter((e) => {
      const d = new Date(e.starts_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    return [...new Set(evts.map((e) => EVENT_TYPE_CONFIG[e.event_type]?.color).filter(Boolean))].slice(0, 3) as string[];
  }

  const dayEvents = filteredEvents.filter((e) => {
    const d = new Date(e.starts_at);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && d.getDate() === selectedDay;
  });

  function navigateMonth(dir: number) {
    const m = new Date(currentMonth);
    m.setMonth(m.getMonth() + dir);
    setCurrentMonth(m);
  }

  function navigateWeek(dir: number) {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7 * dir);
    setWeekBase(d);
  }

  function selectDay(year: number, month: number, day: number) {
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedDay(day);
  }

  const selectedDateLabel = new Date(selectedYear, selectedMonth, selectedDay)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const styles = useStyles(theme);

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text testID="schedule-heading" style={styles.heroTitle}>Schedule</Text>
        <Text testID="month-label" style={styles.heroSub}>{displayMonthLabel}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Community chips + week/month toggle row */}
          <View style={styles.topRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.communityChips}>
              <TouchableOpacity
                testID="community-chip"
                style={[styles.commChip, activeCommunity === 'all' && styles.commChipActive]}
                onPress={() => setActiveCommunity('all')}
                activeOpacity={0.7}>
                <Text style={[styles.commChipLabel, activeCommunity === 'all' && styles.commChipLabelActive]}>All</Text>
              </TouchableOpacity>
              {communities.map((c) => (
                <TouchableOpacity
                  key={c.hoaId}
                  testID="community-chip"
                  style={[styles.commChip, activeCommunity === c.hoaId && styles.commChipActive]}
                  onPress={() => setActiveCommunity(c.hoaId)}
                  activeOpacity={0.7}>
                  <Text style={[styles.commChipLabel, activeCommunity === c.hoaId && styles.commChipLabelActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View testID="view-toggle" style={styles.viewToggle}>
              <TouchableOpacity
                testID="view-toggle-week"
                style={[styles.viewToggleBtn, viewMode === 'week' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('week')}
                activeOpacity={0.7}>
                <Text style={[styles.viewToggleBtnLabel, viewMode === 'week' && styles.viewToggleBtnLabelActive]}>Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="view-toggle-month"
                style={[styles.viewToggleBtn, viewMode === 'month' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('month')}
                activeOpacity={0.7}>
                <Text style={[styles.viewToggleBtnLabel, viewMode === 'month' && styles.viewToggleBtnLabelActive]}>Month</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar card */}
          <View style={styles.calCard}>
            {viewMode === 'month' ? (
              <>
                <View style={styles.calNav}>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateMonth(-1)}>
                    <ChevronLeft color={theme.textSecondary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={styles.calNavLabel}>
                    {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateMonth(1)}>
                    <ChevronRight color={theme.textSecondary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={styles.dayHeaders}>
                  {WEEK_DAYS.map((d) => (
                    <Text key={d} style={styles.dayHeader}>{d}</Text>
                  ))}
                </View>
                <View testID="calendar-grid" style={styles.grid}>
                  {monthGrid.map((cell, idx) => {
                    const cy = currentMonth.getFullYear();
                    const cm = currentMonth.getMonth();
                    const isSel = cell.inMonth && cell.day === selectedDay && cm === selectedMonth && cy === selectedYear;
                    const isToday = cell.inMonth && cell.day === now.getDate() && cm === now.getMonth() && cy === now.getFullYear();
                    const dots = cell.inMonth ? getDotsForDay(cy, cm, cell.day) : [];
                    return (
                      <TouchableOpacity
                        key={idx}
                        testID="day-cell"
                        style={styles.dayCell}
                        onPress={() => { if (cell.inMonth) selectDay(cy, cm, cell.day); }}
                        activeOpacity={cell.inMonth ? 0.7 : 1}>
                        <View style={[
                          styles.dayCellInner,
                          isSel && styles.dayCellSelected,
                          isToday && !isSel && styles.dayCellToday,
                        ]}>
                          <Text style={[
                            styles.dayNum,
                            !cell.inMonth && styles.dayNumOther,
                            isSel && styles.dayNumSelected,
                            isToday && !isSel && styles.dayNumToday,
                          ]}>
                            {cell.day}
                          </Text>
                        </View>
                        <View style={styles.dotRow}>
                          {dots.map((c, j) => (
                            <View key={j} testID="event-dot" style={[styles.dot, { backgroundColor: c }]} />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={styles.calNav}>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateWeek(-1)}>
                    <ChevronLeft color={theme.textSecondary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={styles.calNavLabel}>
                    {weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                    {weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateWeek(1)}>
                    <ChevronRight color={theme.textSecondary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View testID="week-grid" style={styles.weekGrid}>
                  {weekDates.map((date, i) => {
                    const isSel = date.getDate() === selectedDay && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
                    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    const dots = getDotsForDay(date.getFullYear(), date.getMonth(), date.getDate());
                    return (
                      <TouchableOpacity
                        key={i}
                        testID="day-cell"
                        style={styles.weekDayCell}
                        onPress={() => selectDay(date.getFullYear(), date.getMonth(), date.getDate())}
                        activeOpacity={0.7}>
                        <Text style={styles.weekDayLabel}>{WEEK_DAYS[i]}</Text>
                        <View style={[
                          styles.dayCellInner,
                          isSel && styles.dayCellSelected,
                          isToday && !isSel && styles.dayCellToday,
                        ]}>
                          <Text style={[
                            styles.dayNum,
                            isSel && styles.dayNumSelected,
                            isToday && !isSel && styles.dayNumToday,
                          ]}>
                            {date.getDate()}
                          </Text>
                        </View>
                        <View style={styles.dotRow}>
                          {dots.map((c, j) => (
                            <View key={j} testID="event-dot" style={[styles.dot, { backgroundColor: c }]} />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Event type filter chips — tennis-first */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>
            {EVENT_TYPE_FILTERS.map((opt) => {
              const active = activeEventType === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  testID="event-type-tab"
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setActiveEventType(opt)}
                  activeOpacity={0.7}>
                  <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Legend */}
          <View style={styles.legend}>
            {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => (
              <View key={k} testID="legend-item" style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: v.color }]} />
                <Text style={styles.legendLabel}>{v.label}</Text>
              </View>
            ))}
          </View>

          {/* Day events section */}
          <View testID="day-events-section">
            <Text style={styles.dayEventsTitle}>{selectedDateLabel.toUpperCase()}</Text>

            {loading ? (
              <View style={styles.loadingRow}>
                <View style={[styles.spinner, { borderColor: theme.border, borderTopColor: Colors.cyan }]} />
              </View>
            ) : dayEvents.length === 0 ? (
              <Text testID="no-events-msg" style={styles.noEvents}>
                No tennis activity scheduled for this day.
              </Text>
            ) : (
              dayEvents.map((e) => {
                const cfg = EVENT_TYPE_CONFIG[e.event_type] ?? { color: theme.textMuted, label: '' };
                const dt  = new Date(e.starts_at);
                return (
                  <TouchableOpacity
                    key={e.id}
                    testID="event-card"
                    style={styles.eventCard}
                    onPress={() => setDetailEvent(e)}
                    activeOpacity={0.85}>
                    <View style={[styles.eventBar, { backgroundColor: cfg.color }]} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.eventTypePill}>
                        <Text style={[styles.eventTypeLabel, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Text style={styles.eventMeta}>
                        {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        {e.location ? ` · ${e.location}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Event Detail Modal */}
      <Modal
        visible={!!detailEvent}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailEvent(null)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDetailEvent(null)}>
          {detailEvent && (
            <TouchableOpacity activeOpacity={1} style={styles.detailSheet}>
              <View style={styles.detailHandle} />
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{detailEvent.title}</Text>
                <TouchableOpacity onPress={() => setDetailEvent(null)} style={styles.detailClose}>
                  <X color={theme.textMuted} size={20} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {(() => {
                  const cfg = EVENT_TYPE_CONFIG[detailEvent.event_type] ?? { color: theme.textMuted, label: detailEvent.event_type };
                  return (
                    <View style={[styles.typePill, { backgroundColor: cfg.color + '20' }]}>
                      <Text style={[styles.typePillLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  );
                })()}
                <Text style={styles.detailField}>DATE & TIME</Text>
                <Text style={styles.detailValue}>
                  {new Date(detailEvent.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  {'\n'}
                  {new Date(detailEvent.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {detailEvent.location && (
                  <>
                    <Text style={[styles.detailField, { marginTop: 16 }]}>LOCATION</Text>
                    <Text style={styles.detailValue}>{detailEvent.location}</Text>
                  </>
                )}
                {detailEvent.description && (
                  <>
                    <Text style={[styles.detailField, { marginTop: 16 }]}>DETAILS</Text>
                    <Text style={styles.detailValue}>{detailEvent.description}</Text>
                  </>
                )}
              </ScrollView>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function useStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },

    hero: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 24,
      paddingBottom: 20,
    },
    heroTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.display,
      color: theme.textPrimary,
      letterSpacing: -0.8,
      lineHeight: 42,
    },
    heroSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },

    content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },

    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    communityChips: { gap: 8, paddingRight: 4 },
    commChip: {
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.cardBg,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commChipActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
    commChipLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textMuted },
    commChipLabelActive: { color: '#FFF' },

    viewToggle: {
      flexDirection: 'row',
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      flexShrink: 0,
    },
    viewToggleBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: theme.cardBg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    viewToggleBtnActive: { backgroundColor: Colors.blue },
    viewToggleBtnLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textMuted },
    viewToggleBtnLabelActive: { color: '#FFF' },

    calCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    calNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calNavLabel: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 14, color: theme.textPrimary },
    dayHeaders: { flexDirection: 'row', marginBottom: 4 },
    dayHeader: {
      flex: 1,
      textAlign: 'center',
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: theme.textMuted,
      letterSpacing: 0.4,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
    dayCellInner: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellSelected: { backgroundColor: Colors.blue },
    dayCellToday: { borderWidth: 1.5, borderColor: Colors.cyan },
    dayNum: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textSecondary },
    dayNumOther: { opacity: 0.3 },
    dayNumSelected: { color: '#FFF', fontFamily: FontFamily.manropeBold },
    dayNumToday: { color: Colors.cyan },
    dotRow: { flexDirection: 'row', gap: 2, marginTop: 2, height: 5, justifyContent: 'center' },
    dot: { width: 4, height: 4, borderRadius: 2 },

    weekGrid: { flexDirection: 'row' },
    weekDayCell: { flex: 1, alignItems: 'center', gap: 4 },
    weekDayLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: theme.textMuted, letterSpacing: 0.4 },

    typeChips: { gap: 8, paddingVertical: 4 },
    typeChip: {
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: theme.cardBg,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeChipActive: { backgroundColor: theme.selectedBg, borderColor: theme.selectedBorder },
    typeChipLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textSecondary },
    typeChipLabelActive: { color: theme.selectedBorder },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted },

    dayEventsTitle: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.4,
      marginBottom: 10,
      marginTop: 4,
    },
    loadingRow: { alignItems: 'center', paddingVertical: 24 },
    spinner: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      borderTopColor: Colors.cyan,
    },
    noEvents: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
    },

    eventCard: {
      flexDirection: 'row',
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
      alignItems: 'flex-start',
      ...theme.shadowCard,
    },
    eventBar: { width: 3, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0 },
    eventTypePill: {},
    eventTypeLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      letterSpacing: 1.2,
    },
    eventTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 15,
      color: theme.textPrimary,
    },
    eventMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    detailSheet: {
      backgroundColor: theme.sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: theme.border,
      padding: Spacing.pagePx,
      paddingTop: 12,
      maxHeight: '80%',
      ...theme.shadowSheet,
    },
    detailHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center', marginBottom: 16,
    },
    detailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
      gap: 8,
    },
    detailTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: theme.textPrimary,
      flex: 1,
      letterSpacing: -0.2,
    },
    detailClose: {
      width: 36, height: 36,
      backgroundColor: theme.surface2,
      borderRadius: Radius.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    typePill: {
      alignSelf: 'flex-start',
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 14,
    },
    typePillLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      letterSpacing: 1.2,
    },
    detailField: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.4,
      marginBottom: 4,
    },
    detailValue: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      lineHeight: 22,
    },
  }), [theme]);
}
