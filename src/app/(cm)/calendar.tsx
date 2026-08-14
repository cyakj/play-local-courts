import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Shadow, Spacing,
} from '@/constants/design';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: Colors.accentCyan, label: 'Community Event' },
  board_meeting: { color: Colors.navy, label: 'Board Meeting' },
  maintenance_scheduled: { color: Colors.coral, label: 'Maintenance' },
  reservation: { color: Colors.blue, label: 'Reservation' },
  blockout: { color: Colors.volt, label: 'Blockout' },
};

const TYPE_LABELS = ['All', 'Community Events', 'Board Meetings', 'Maintenance', 'Reservations', 'Blockouts'];
const TYPE_MAP: Record<string, string> = {
  'Community Events': 'community_event',
  'Board Meetings': 'board_meeting',
  Maintenance: 'maintenance_scheduled',
  Reservations: 'reservation',
  Blockouts: 'blockout',
};
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Hoa { id: string; name: string; }
interface CalEvent {
  id: string;
  hoa_id: string;
  community: string;
  title: string;
  type: string;
  day: number;
  month: number;
  year: number;
  time: string;
  location: string;
  rsvp: number | null;
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

function getWeekDates(year: number, month: number, day: number) {
  const base = new Date(year, month, day);
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onChange(!value)}
      style={[styles.toggle, { backgroundColor: value ? Colors.accentCyan : '#E5E7EB' }]}>
      <View style={[styles.toggleThumb, { left: value ? 22 : 2 }]} />
    </TouchableOpacity>
  );
}

export default function CMCalendarScreen() {
  const insets = useSafeAreaInsets();
  const now = new Date();

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [communityFilter, setCommunityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const [hoas, setHoas] = useState<Hoa[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState('community_event');
  const [evDate, setEvDate] = useState(now.toISOString().split('T')[0]);
  const [evStartTime, setEvStartTime] = useState('10:00');
  const [evEndTime, setEvEndTime] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evRsvp, setEvRsvp] = useState(false);
  const [evNotify, setEvNotify] = useState(true);
  const [evCommunityId, setEvCommunityId] = useState('');
  const [creating, setCreating] = useState(false);

  async function fetchEvents(hoaList: Hoa[]) {
    if (hoaList.length === 0) { setLoading(false); return; }
    const hoaIds = hoaList.map((h) => h.id);
    const hoaMap = new Map(hoaList.map((h) => [h.id, h.name]));

    const windowStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const windowEnd = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [hoaEventsRes, courtsRes] = await Promise.all([
      supabase
        .from('hoa_events')
        .select('id, hoa_id, title, event_type, location, starts_at, rsvp_enabled')
        .in('hoa_id', hoaIds)
        .eq('status', 'active'),
      supabase.from('courts').select('id, name, hoa_id').in('hoa_id', hoaIds),
    ]);

    const hoaEvents = hoaEventsRes.data ?? [];
    const courtIds = (courtsRes.data ?? []).map((c) => c.id);

    const eventIds = hoaEvents.map((e) => e.id);
    const rsvpCounts = new Map<string, number>();
    if (eventIds.length > 0) {
      const { data: rsvps } = await supabase
        .from('hoa_event_rsvps')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('response', 'going');
      if (rsvps) {
        for (const r of rsvps) rsvpCounts.set(r.event_id, (rsvpCounts.get(r.event_id) || 0) + 1);
      }
    }

    const calEvents: CalEvent[] = hoaEvents.map((e) => {
      const dt = new Date(e.starts_at);
      return {
        id: e.id,
        hoa_id: e.hoa_id,
        community: hoaMap.get(e.hoa_id) || '',
        title: e.title,
        type: e.event_type,
        day: dt.getDate(),
        month: dt.getMonth(),
        year: dt.getFullYear(),
        time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        location: e.location || '',
        rsvp: e.rsvp_enabled ? (rsvpCounts.get(e.id) || 0) : null,
      };
    });

    if (courtIds.length > 0) {
      const [bookingsRes, maintenanceRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, date, start_time, court_id, courts(name, hoa_id)')
          .in('court_id', courtIds)
          .gte('date', windowStart)
          .lte('date', windowEnd)
          .neq('status', 'cancelled'),
        supabase
          .from('court_maintenance')
          .select('id, date, start_time, court_id, description, courts(name, hoa_id)')
          .in('court_id', courtIds)
          .gte('date', windowStart)
          .lte('date', windowEnd),
      ]);

      for (const b of bookingsRes.data ?? []) {
        const court = (b as any).courts;
        if (!court) continue;
        const dt = new Date(`${b.date}T${b.start_time}`);
        calEvents.push({
          id: `reservation-${b.id}`,
          hoa_id: court.hoa_id,
          community: hoaMap.get(court.hoa_id) || '',
          title: `${court.name} Reservation`,
          type: 'reservation',
          day: dt.getDate(),
          month: dt.getMonth(),
          year: dt.getFullYear(),
          time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          location: court.name,
          rsvp: null,
        });
      }

      for (const m of maintenanceRes.data ?? []) {
        const court = (m as any).courts;
        if (!court) continue;
        const dt = new Date(`${m.date}T${m.start_time}`);
        calEvents.push({
          id: `blockout-${m.id}`,
          hoa_id: court.hoa_id,
          community: hoaMap.get(court.hoa_id) || '',
          title: m.description ? `${court.name} Blockout: ${m.description}` : `${court.name} Blockout`,
          type: 'blockout',
          day: dt.getDate(),
          month: dt.getMonth(),
          year: dt.getFullYear(),
          time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          location: court.name,
          rsvp: null,
        });
      }
    }

    setEvents(calEvents);
    setLoading(false);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data: hoaData } = await supabase.from('hoas').select('id, name').order('name');
      const h = hoaData ?? [];
      setHoas(h);
      if (h.length > 0) setEvCommunityId(h[0].id);
      await fetchEvents(h);
    }
    load();
  }, []);

  const communityOptions = ['All', ...hoas.map((h) => h.name)];
  const monthGrid = useMemo(
    () => buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );
  const weekDates = useMemo(
    () => getWeekDates(selectedYear, selectedMonth, selectedDay),
    [selectedDay, selectedMonth, selectedYear]
  );

  const filtered = useMemo(() => events.filter((e) =>
    (communityFilter === 'All' || e.community === communityFilter) &&
    (typeFilter === 'All' || e.type === TYPE_MAP[typeFilter])
  ), [events, communityFilter, typeFilter]);

  const dayEvents = filtered.filter((e) =>
    e.day === selectedDay && e.month === selectedMonth && e.year === selectedYear
  );

  function getDotsForDay(year: number, month: number, day: number) {
    const evts = filtered.filter((e) => e.year === year && e.month === month && e.day === day);
    return [...new Set(evts.map((e) => EVENT_TYPE_CONFIG[e.type]?.color).filter(Boolean))].slice(0, 3) as string[];
  }

  function navigateMonth(dir: number) {
    const m = new Date(currentMonth);
    m.setMonth(m.getMonth() + dir);
    setCurrentMonth(m);
  }

  async function handleCreateEvent() {
    if (!evTitle.trim() || !evDate || !evStartTime || !evCommunityId || !userId) return;
    setCreating(true);
    const startsAt = new Date(`${evDate}T${evStartTime}`).toISOString();
    const endsAt = evEndTime ? new Date(`${evDate}T${evEndTime}`).toISOString() : null;

    const { error } = await supabase.from('hoa_events').insert({
      hoa_id: evCommunityId,
      created_by: userId,
      title: evTitle.trim(),
      description: evDescription.trim() || null,
      event_type: evType,
      location: evLocation.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      rsvp_enabled: evRsvp,
      status: 'active',
    });

    if (!error && evNotify) {
      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .eq('hoa_id', evCommunityId)
        .eq('status', 'approved');
      if (members) {
        const notifs = members
          .filter((m: any) => m.user_id !== userId)
          .map((m: any) => ({
            user_id: m.user_id,
            hoa_id: evCommunityId,
            type: 'event_created' as const,
            title: `New event: ${evTitle.trim()}`,
            body: `${evDate} at ${evStartTime}${evLocation ? ` · ${evLocation}` : ''}`,
          }));
        if (notifs.length > 0) await supabase.from('hoa_notifications').insert(notifs);
      }
    }

    setCreating(false);
    setShowAdd(false);
    setEvTitle('');
    setEvDate(now.toISOString().split('T')[0]);
    setEvStartTime('10:00');
    setEvEndTime('');
    setEvLocation('');
    setEvDescription('');
    setEvRsvp(false);
    setEvNotify(true);
    await fetchEvents(hoas);
  }

  const displayMonth = viewMode === 'month' ? currentMonth : (weekDates[3] || now);
  const displayMonthLabel = displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const calNavLabel = viewMode === 'month'
    ? currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : `${weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const selectedDayLabel = `${new Date(selectedYear, selectedMonth).toLocaleString('en-US', { month: 'short' })} ${selectedDay} Events`;

  return (
    <View style={styles.screen}>
      {/* Custom navy header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Calendar</Text>
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
        <Text style={styles.headerSub}>{displayMonthLabel}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContent}>
          {communityOptions.map((opt) => {
            const active = communityFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCommunityFilter(opt)}
                activeOpacity={0.7}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Calendar card */}
          <View style={styles.calCard}>
            <View style={styles.calNav}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => viewMode === 'month' ? navigateMonth(-1) : undefined}>
                <ChevronLeft color="#4B5563" size={18} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.calNavLabel}>{calNavLabel}</Text>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => viewMode === 'month' ? navigateMonth(1) : undefined}>
                <ChevronRight color="#4B5563" size={18} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.dayHeaders}>
              {WEEK_DAYS.map((d) => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {viewMode === 'month' ? (
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
                      onPress={() => {
                        if (!cell.inMonth) return;
                        setSelectedDay(cell.day);
                        setSelectedMonth(cm);
                        setSelectedYear(cy);
                      }}
                      activeOpacity={cell.inMonth ? 0.7 : 1}>
                      <View style={[
                        styles.dayCellInner,
                        isSel && styles.dayCellSelected,
                        isToday && !isSel && styles.dayCellToday,
                      ]}>
                        <Text style={[
                          styles.dayNum,
                          !cell.inMonth && styles.dayNumOtherMonth,
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
            ) : (
              <View style={styles.grid}>
                {weekDates.map((date, i) => {
                  const isSel = date.getDate() === selectedDay && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
                  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  const dots = getDotsForDay(date.getFullYear(), date.getMonth(), date.getDate());
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.dayCell}
                      onPress={() => {
                        setSelectedDay(date.getDate());
                        setSelectedMonth(date.getMonth());
                        setSelectedYear(date.getFullYear());
                      }}
                      activeOpacity={0.7}>
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
            )}
          </View>

          {/* Event type filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeContent}>
            {TYPE_LABELS.map((opt) => {
              const active = typeFilter === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setTypeFilter(opt)}
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

          {/* Events section header */}
          <Text style={styles.dayEventsTitle}>{selectedDayLabel.toUpperCase()}</Text>

          {loading ? (
            <View style={styles.loadingRow}>
              <View style={styles.loadingSpinner} />
            </View>
          ) : dayEvents.length === 0 ? (
            <Text style={styles.noEvents}>No events on this day</Text>
          ) : (
            dayEvents.map((e) => {
              const cfg = EVENT_TYPE_CONFIG[e.type] || { color: Colors.textMuted, label: '' };
              return (
                <View key={e.id} style={[styles.eventCard, { borderLeftColor: cfg.color }]}>
                  <View style={styles.eventCardTop}>
                    <Text style={styles.eventTitle}>{e.title}</Text>
                    {e.rsvp !== null && (
                      <View style={styles.rsvpBadge}>
                        <Text style={styles.rsvpText}>{e.rsvp} Going</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.eventTime}>{e.time}{e.location ? ` · ${e.location}` : ''}</Text>
                  <Text style={styles.eventCommunity}>{e.community}</Text>
                  <View style={[styles.eventTypePill, { backgroundColor: cfg.color + '24' }]}>
                    <Text style={[styles.eventTypeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Add Event button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, 20) + 100 }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}>
        <Plus color={Colors.white} size={24} strokeWidth={2} />
      </TouchableOpacity>

      {/* Add Event bottom sheet modal */}
      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAdd(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Event</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)} style={styles.sheetClose}>
                <X color={Colors.textMuted} size={20} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Event Title *</Text>
              <TextInput
                style={styles.input}
                value={evTitle}
                onChangeText={setEvTitle}
                placeholder="E.g. Community BBQ"
                placeholderTextColor={Colors.textPlaceholder}
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Event Type</Text>
              <View style={styles.typeGrid}>
                {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeOption, {
                      borderColor: evType === key ? cfg.color : '#E5E7EB',
                      backgroundColor: evType === key ? cfg.color + '18' : Colors.white,
                    }]}
                    onPress={() => setEvType(key)}
                    activeOpacity={0.7}>
                    <View style={[styles.typeOptionDot, { backgroundColor: cfg.color }]} />
                    <Text style={[styles.typeOptionLabel, { color: evType === key ? cfg.color : '#4B5563' }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Date *</Text>
              <TextInput
                style={styles.input}
                value={evDate}
                onChangeText={setEvDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textPlaceholder}
              />

              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Start *</Text>
                  <TextInput
                    style={styles.input}
                    value={evStartTime}
                    onChangeText={setEvStartTime}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.textPlaceholder}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>End</Text>
                  <TextInput
                    style={styles.input}
                    value={evEndTime}
                    onChangeText={setEvEndTime}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.textPlaceholder}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Location</Text>
              <TextInput
                style={styles.input}
                value={evLocation}
                onChangeText={setEvLocation}
                placeholder="E.g. Community Center"
                placeholderTextColor={Colors.textPlaceholder}
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={evDescription}
                onChangeText={setEvDescription}
                placeholder="Optional details..."
                placeholderTextColor={Colors.textPlaceholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {hoas.length > 1 && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Community</Text>
                  <View style={styles.typeGrid}>
                    {hoas.map((h) => (
                      <TouchableOpacity
                        key={h.id}
                        style={[styles.typeOption, {
                          borderColor: evCommunityId === h.id ? Colors.navy : '#E5E7EB',
                          backgroundColor: evCommunityId === h.id ? Colors.navy + '12' : Colors.white,
                        }]}
                        onPress={() => setEvCommunityId(h.id)}
                        activeOpacity={0.7}>
                        <Text style={[styles.typeOptionLabel, { color: evCommunityId === h.id ? Colors.navy : '#4B5563' }]}>
                          {h.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {[
                { label: 'Enable RSVP', value: evRsvp, onChange: setEvRsvp },
                { label: 'Notify Residents', value: evNotify, onChange: setEvNotify },
              ].map(({ label, value, onChange }) => (
                <View key={label} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Toggle value={value} onChange={onChange} />
                </View>
              ))}

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtnLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, (!evTitle.trim() || creating) && styles.addBtnDisabled]}
                onPress={handleCreateEvent}
                disabled={!evTitle.trim() || creating}>
                <Text style={styles.addBtnLabel}>{creating ? 'Adding Event…' : 'Add Event'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 28,
    color: Colors.white,
    lineHeight: 32,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: { backgroundColor: 'rgba(0,212,255,0.3)' },
  viewToggleBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  viewToggleBtnLabelActive: { color: Colors.white },
  headerSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 12,
  },
  chipScroll: {},
  chipContent: { gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'transparent',
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  chipLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.white },
  chipLabelActive: { color: Colors.navy },

  content: { padding: Spacing.pagePx, paddingBottom: 180, gap: 12 },

  calCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.06)',
    overflow: 'hidden',
    ...Shadow,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavLabel: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: Colors.navy },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 16 },
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
  dayNumOtherMonth: { color: '#D1D5DB' },
  dayNumSelected: { color: Colors.white },
  dayNumToday: { color: Colors.accentCyan },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  typeContent: { gap: 8, paddingBottom: 2 },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typeChipLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.textMuted },
  typeChipLabelActive: { color: Colors.white },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: FontFamily.interRegular, fontSize: 13, color: '#4B5563' },

  dayEventsTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 13,
    color: Colors.navy,
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  loadingRow: { alignItems: 'center', paddingVertical: 32 },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.2)',
    borderTopColor: Colors.accentCyan,
  },
  noEvents: {
    textAlign: 'center',
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: '#4B5563',
    paddingVertical: 32,
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.06)',
    borderLeftWidth: 3,
    ...Shadow,
  },
  eventCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  eventTitle: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.navy, flex: 1 },
  rsvpBadge: {
    backgroundColor: '#E0F9FF',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  rsvpText: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: Colors.blueMid },
  eventTime: { fontFamily: FontFamily.interRegular, fontSize: 13, color: '#4B5563', marginBottom: 2 },
  eventCommunity: { fontFamily: FontFamily.interRegular, fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  eventTypePill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  eventTypeLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 11 },

  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: { fontFamily: FontFamily.manropeBold, fontSize: 20, color: Colors.navy },
  sheetClose: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.navy, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.15)',
    borderRadius: 8,
    padding: 12,
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputMultiline: { minHeight: 80 },
  timeRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 44,
  },
  typeOptionDot: { width: 12, height: 12, borderRadius: 2 },
  typeOptionLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.pageBg,
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  toggleLabel: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textPrimary },
  toggle: { width: 44, height: 24, borderRadius: 99, position: 'relative' },
  toggleThumb: {
    position: 'absolute',
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
    minHeight: 48,
  },
  cancelBtnLabel: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.navy },
  addBtn: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    marginBottom: 8,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnLabel: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: Colors.white },
});
