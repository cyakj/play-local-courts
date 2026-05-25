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

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  amenity_booking: { color: Colors.accentCyan, label: 'Amenity Booking' },
  community_event: { color: Colors.navy, label: 'Community Event' },
  board_meeting: { color: Colors.textMuted, label: 'Board Meeting' },
  maintenance_scheduled: { color: Colors.coral, label: 'Maintenance' },
};

const EVENT_TYPE_FILTERS = ['All', 'Amenity Booking', 'Community Event', 'Board Meeting', 'Maintenance'];
const EVENT_TYPE_FILTER_MAP: Record<string, string> = {
  'Amenity Booking': 'amenity_booking',
  'Community Event': 'community_event',
  'Board Meeting': 'board_meeting',
  Maintenance: 'maintenance_scheduled',
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Community { hoaId: string; name: string; }
interface CalendarEvent {
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

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [weekBase, setWeekBase] = useState(now);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunity, setActiveCommunity] = useState('all');
  const [activeEventType, setActiveEventType] = useState('All');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [userId, setUserId] = useState('');

  const monthGrid = useMemo(() => buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);
  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);

  const displayMonth = viewMode === 'month' ? currentMonth : (weekDates[3] || now);
  const displayMonthLabel = displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  async function fetchAll(uid: string, comms: Community[]) {
    if (comms.length === 0) { setLoading(false); return; }
    setLoading(true);
    const hoaIds = comms.map((c) => c.hoaId);
    const hoaMap = new Map(comms.map((c) => [c.hoaId, c.name]));

    const { data: hoaEvents } = await supabase
      .from('hoa_events')
      .select('id, title, event_type, location, starts_at, hoa_id, description')
      .in('hoa_id', hoaIds)
      .eq('status', 'approved')
      .order('starts_at');

    const mapped: CalendarEvent[] = (hoaEvents || []).map((e) => ({
      id: e.id,
      title: e.title,
      event_type: e.event_type,
      location: e.location || null,
      starts_at: e.starts_at,
      hoa_id: e.hoa_id,
      community_name: hoaMap.get(e.hoa_id) || '',
      description: e.description || null,
    }));

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
        const endHour = b.end_time?.slice(0, 5) || '';
        mapped.push({
          id: b.id,
          title: `${court.name} · ${fmtTime(startHour)} – ${fmtTime(endHour)}`,
          event_type: 'amenity_booking',
          location: court.name,
          starts_at: `${b.date}T${b.start_time}`,
          hoa_id: court.hoa_id,
          community_name: hoaMap.get(court.hoa_id) || '',
          description: null,
        });
      }
    }

    mapped.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    setEvents(mapped);
    setLoading(false);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
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
    }
    load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('resident-calendar-bookings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `user_id=eq.${userId}`,
      }, () => { fetchAll(userId, communities); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, communities]);

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (activeCommunity !== 'all' && e.hoa_id !== activeCommunity) return false;
    const typeKey = EVENT_TYPE_FILTER_MAP[activeEventType];
    if (activeEventType !== 'All' && e.event_type !== typeKey) return false;
    return true;
  }), [events, activeCommunity, activeEventType]);

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

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

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
                style={[styles.commChip, activeCommunity === 'all' && styles.commChipActive]}
                onPress={() => setActiveCommunity('all')}
                activeOpacity={0.7}>
                <Text style={[styles.commChipLabel, activeCommunity === 'all' && styles.commChipLabelActive]}>All</Text>
              </TouchableOpacity>
              {communities.map((c) => (
                <TouchableOpacity
                  key={c.hoaId}
                  style={[styles.commChip, activeCommunity === c.hoaId && styles.commChipActive]}
                  onPress={() => setActiveCommunity(c.hoaId)}
                  activeOpacity={0.7}>
                  <Text style={[styles.commChipLabel, activeCommunity === c.hoaId && styles.commChipLabelActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.viewToggle}>
              {(['week', 'month'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode(mode)}
                  activeOpacity={0.7}>
                  <Text style={[styles.viewToggleBtnLabel, viewMode === mode && styles.viewToggleBtnLabelActive]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calendar card */}
          <View style={styles.calCard}>
            {viewMode === 'month' ? (
              <>
                <View style={styles.calNav}>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateMonth(-1)}>
                    <ChevronLeft color="#4B5563" size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={styles.calNavLabel}>
                    {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateMonth(1)}>
                    <ChevronRight color="#4B5563" size={16} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={styles.dayHeaders}>
                  {WEEK_DAYS.map((d) => (
                    <Text key={d} style={styles.dayHeader}>{d}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {monthGrid.map((cell, idx) => {
                    const cy = currentMonth.getFullYear();
                    const cm = currentMonth.getMonth();
                    const isSel = cell.inMonth && cell.day === selectedDay && cm === selectedMonth && cy === selectedYear;
                    const isToday = cell.inMonth && cell.day === now.getDate() && cm === now.getMonth() && cy === now.getFullYear();
                    const dots = cell.inMonth ? getDotsForDay(cy, cm, cell.day) : [];
                    return (
                      <TouchableOpacity
                        key={idx}
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
                          {dots.map((c, j) => <View key={j} style={[styles.dot, { backgroundColor: c }]} />)}
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
                    <ChevronLeft color="#4B5563" size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={styles.calNavLabel}>
                    {weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <TouchableOpacity style={styles.navBtn} onPress={() => navigateWeek(1)}>
                    <ChevronRight color="#4B5563" size={16} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={styles.weekGrid}>
                  {weekDates.map((date, i) => {
                    const isSel = date.getDate() === selectedDay && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
                    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    const dots = getDotsForDay(date.getFullYear(), date.getMonth(), date.getDate());
                    return (
                      <TouchableOpacity
                        key={i}
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
                          {dots.map((c, j) => <View key={j} style={[styles.dot, { backgroundColor: c }]} />)}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Event type filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>
            {EVENT_TYPE_FILTERS.map((opt) => {
              const active = activeEventType === opt;
              return (
                <TouchableOpacity
                  key={opt}
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
              <View key={k} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: v.color }]} />
                <Text style={styles.legendLabel}>{v.label}</Text>
              </View>
            ))}
          </View>

          {/* Day events section */}
          <Text style={styles.dayEventsTitle}>
            {`${new Date(selectedYear, selectedMonth).toLocaleString('en-US', { month: 'short' })} ${selectedDay} Events`.toUpperCase()}
          </Text>

          {loading ? (
            <View style={styles.loadingRow}>
              <View style={styles.spinner} />
            </View>
          ) : dayEvents.length === 0 ? (
            <Text style={styles.noEvents}>No events on this day</Text>
          ) : (
            dayEvents.map((e) => {
              const cfg = EVENT_TYPE_CONFIG[e.event_type] || { color: Colors.textMuted, label: '' };
              const dt = new Date(e.starts_at);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={styles.eventCard}
                  onPress={() => setDetailEvent(e)}
                  activeOpacity={0.85}>
                  <View style={[styles.eventBar, { backgroundColor: cfg.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{e.title}</Text>
                    <Text style={styles.eventMeta}>
                      {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {e.location ? ` · ${e.location}` : ''}
                    </Text>
                    {e.community_name ? <Text style={styles.eventMeta}>{e.community_name}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
                  <X color={Colors.textMuted} size={20} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                <View style={[styles.typePill, { backgroundColor: (EVENT_TYPE_CONFIG[detailEvent.event_type]?.color || Colors.textMuted) + '20' }]}>
                  <Text style={[styles.typePillLabel, { color: EVENT_TYPE_CONFIG[detailEvent.event_type]?.color || Colors.textMuted }]}>
                    {EVENT_TYPE_CONFIG[detailEvent.event_type]?.label || detailEvent.event_type}
                  </Text>
                </View>
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
                {detailEvent.community_name && (
                  <>
                    <Text style={[styles.detailField, { marginTop: 16 }]}>COMMUNITY</Text>
                    <Text style={styles.detailValue}>{detailEvent.community_name}</Text>
                  </>
                )}
                {detailEvent.description && (
                  <>
                    <Text style={[styles.detailField, { marginTop: 16 }]}>DESCRIPTION</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityChips: { gap: 8, paddingRight: 4 },
  commChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.cardBg,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  commChipLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.textMuted },
  commChipLabelActive: { color: Colors.white },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: { backgroundColor: Colors.navy },
  viewToggleBtnLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: Colors.textMuted },
  viewToggleBtnLabelActive: { color: Colors.white },

  calCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.06)',
    ...Shadow,
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
  calNavLabel: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: Colors.navy },
  dayHeaders: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: '#4B5563',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
  dayCellInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.navy,
    borderWidth: 2,
    borderColor: Colors.accentCyan,
  },
  dayCellToday: { backgroundColor: 'rgba(0,212,255,0.1)' },
  dayNum: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: Colors.textPrimary },
  dayNumOther: { color: '#D1D5DB' },
  dayNumSelected: { color: Colors.white },
  dayNumToday: { color: Colors.accentCyan },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  weekGrid: { flexDirection: 'row' },
  weekDayCell: { flex: 1, alignItems: 'center', gap: 4 },
  weekDayLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: '#4B5563' },

  typeChips: { gap: 8, paddingBottom: 2 },
  typeChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.cardBg,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typeChipLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.textMuted },
  typeChipLabelActive: { color: Colors.white },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: FontFamily.interRegular, fontSize: 12, color: '#4B5563' },

  dayEventsTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 13,
    color: Colors.navy,
    letterSpacing: 1,
    marginTop: 4,
  },
  loadingRow: { alignItems: 'center', paddingVertical: 32 },
  spinner: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.2)',
    borderTopColor: Colors.accentCyan,
  },
  noEvents: {
    textAlign: 'center',
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: '#4B5563',
    paddingVertical: 24,
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    ...Shadow,
  },
  eventBar: { width: 4, borderRadius: 4, minHeight: 50 },
  eventTitle: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.navy },
  eventMeta: {
    fontFamily: FontFamily.interRegular,
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  detailHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  detailTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    flex: 1,
  },
  detailClose: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  typePillLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel },
  detailField: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  detailValue: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: Colors.navy },
});
