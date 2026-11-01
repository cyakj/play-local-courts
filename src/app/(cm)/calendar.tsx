import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ban, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Gavel, Plus, Users, Wrench, X, type LucideIcon } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { platformAlert } from '@/lib/platformAlert';
import { COMMUNITY_TIME_ZONE, communityToday, earliestCommunityToday } from '@/lib/communityTime';
import { loadHoaZones } from '@/lib/hoaZones';
import {
  addDays, addMonths, buildMonthWeeks, communityWallToIso, dedupeEvents, EVENT_TYPE_LABEL, expandBlockout, filterEvents,
  formatClock, groupByDate, isoToCommunityWall, parseIso, weekOf, type CalendarEvent, type EventType,
} from '@/lib/adminCalendar';
import { formatDateFull } from '@/lib/format';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import { lightTheme } from '@/constants/theme-tokens';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { TimePicker } from '@/components/ui/TimePicker';
import {
  AdminHeader, AdminScreen, Button, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, IconButton, Pill, Toggle,
} from '@/components/admin/kit';

interface Hoa { id: string; name: string }

// Type identity never relies on colour alone: every type has its own icon and text label.
const TYPE_META: Record<EventType, { color: string; Icon: LucideIcon }> = {
  community_event: { color: '#1A7FBF', Icon: Users },
  board_meeting: { color: '#0F2A57', Icon: Gavel },
  maintenance_scheduled: { color: '#B7791F', Icon: Wrench },
  reservation: { color: '#2D6BFF', Icon: CalendarClock },
  blockout: { color: '#E5384A', Icon: Ban },
};
// The manager calendar is for community events, management activity, scheduled maintenance and blockouts.
// Routine resident reservations are deliberately NOT part of it (they would drown the calendar); managers
// inspect them per amenity in Manage Amenities → Schedule. 'reservation' stays in TYPE_META only because
// the shared EventType union (src/lib/adminCalendar.ts) still includes it.
const ALL_TYPES: EventType[] = ['community_event', 'board_meeting', 'maintenance_scheduled', 'blockout'];
const CREATABLE: EventType[] = ['community_event', 'board_meeting', 'maintenance_scheduled'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const isoToDate = (iso: string) => { const p = parseIso(iso); return new Date(p.y, p.m - 1, p.d); };
const dateToIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [hoas, setHoas] = useState<Hoa[]>([]);
  // Each community's own reservation zone (hoas.timezone). "Today" follows the filtered community's zone; with all communities it is the earliest date among them.
  const [zones, setZones] = useState<Map<string, string>>(new Map());
  const [hoaFilter, setHoaFilter] = useState<string | 'all'>('all');
  const today = useMemo(
    () => (hoaFilter !== 'all' ? communityToday(new Date(), zones.get(hoaFilter) ?? COMMUNITY_TIME_ZONE) : earliestCommunityToday([...zones.values()])),
    [hoaFilter, zones],
  );
  const [pickedDate, setSelected] = useState<string | null>(null);
  const selected = pickedDate ?? today; // until the user picks a day, follow the community's own "today"
  const [typeFilter, setTypeFilter] = useState<Set<EventType>>(new Set());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const sel = parseIso(selected);
  const weeks = useMemo(() => buildMonthWeeks(sel.y, sel.m), [sel.y, sel.m]);
  const weekDates = useMemo(() => weekOf(selected), [selected]);
  const windowRange = useMemo(() => ({ from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date }), [weeks]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      const { data, error: err } = await supabase.from('hoas').select('id, name').order('name');
      if (err) { setError(err.message); return; }
      setHoas(data ?? []);
      try { setZones(await loadHoaZones((data ?? []).map((h) => h.id))); } catch (e) { setError(errorMessage(e, 'Could not load community time zones.')); }
    })();
  }, []);

  const fetchEvents = useCallback(async () => {
    if (hoas.length === 0 || zones.size === 0) { setLoading(false); return; }
    setError(null);
    try {
      const hoaIds = hoas.map((h) => h.id);
      const hoaName = new Map(hoas.map((h) => [h.id, h.name]));
      const { from, to } = windowRange;
      // Query a day wider on each side (communities sit in different zones), then keep only events whose OWN-zone date is in the window.
      const startIso = communityWallToIso(addDays(from, -1), '00:00');
      const endIso = communityWallToIso(addDays(to, 2), '00:00');

      const [evRes, courtRes] = await Promise.all([
        supabase.from('hoa_events').select('id, hoa_id, title, event_type, location, starts_at, ends_at, rsvp_enabled, description')
          .in('hoa_id', hoaIds).eq('status', 'active').gte('starts_at', startIso).lt('starts_at', endIso),
        supabase.from('courts').select('id, name, hoa_id').in('hoa_id', hoaIds),
      ]);
      if (evRes.error) throw evRes.error;
      if (courtRes.error) throw courtRes.error;
      const courts = courtRes.data ?? [];
      const courtById = new Map(courts.map((c) => [c.id, c]));
      const courtIds = courts.map((c) => c.id);

      const out: CalendarEvent[] = [];
      const rsvpCounts = new Map<string, number>();
      const evIds = (evRes.data ?? []).map((e) => e.id);
      if (evIds.length) {
        const { data: rsvps, error: rErr } = await supabase.from('hoa_event_rsvps').select('event_id').in('event_id', evIds).eq('response', 'going');
        if (rErr) throw rErr;
        for (const r of rsvps ?? []) rsvpCounts.set(r.event_id, (rsvpCounts.get(r.event_id) ?? 0) + 1);
      }
      for (const e of evRes.data ?? []) {
        const zone = zones.get(e.hoa_id) ?? COMMUNITY_TIME_ZONE;
        const start = isoToCommunityWall(e.starts_at, zone);
        if (start.date < from || start.date > to) continue;
        const end = e.ends_at ? isoToCommunityWall(e.ends_at, zone) : null;
        const type = (ALL_TYPES as string[]).includes(e.event_type) ? (e.event_type as EventType) : 'community_event';
        out.push({
          id: e.id, hoaId: e.hoa_id, community: hoaName.get(e.hoa_id) ?? '', type, title: e.title,
          date: start.date, startTime: start.time, endTime: end && end.date === start.date ? end.time : null,
          location: e.location ?? '',
          detail: [e.description, e.rsvp_enabled ? `${rsvpCounts.get(e.id) ?? 0} going` : null].filter(Boolean).join(' · ') || undefined,
        });
      }

      if (courtIds.length) {
        const [mt] = await Promise.all([
          supabase.from('court_maintenance').select('id, court_id, date, end_date, start_time, end_time, description')
            .in('court_id', courtIds).lte('date', to).or(`end_date.gte.${from},and(end_date.is.null,date.gte.${from})`),
        ]);
        if (mt.error) throw mt.error;
        for (const m of mt.data ?? []) {
          const c = courtById.get(m.court_id);
          if (!c) continue;
          out.push(...expandBlockout({
            id: m.id, hoaId: c.hoa_id, community: hoaName.get(c.hoa_id) ?? '', courtName: c.name, date: m.date,
            endDate: m.end_date, startTime: m.start_time, endTime: m.end_time, description: m.description,
          }, windowRange));
        }
      }
      setEvents(dedupeEvents(out));
    } catch (e) {
      setError(errorMessage(e, 'Could not load the calendar.'));
    } finally {
      setLoading(false);
    }
  }, [hoas, zones, windowRange]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = useMemo(
    () => filterEvents(events, { hoaId: hoaFilter, types: typeFilter.size === 0 ? 'all' : typeFilter }),
    [events, hoaFilter, typeFilter],
  );
  const byDate = useMemo(() => groupByDate(filtered), [filtered]);

  const listDates = view === 'week' ? weekDates : [selected];
  const label = view === 'month'
    ? `${MONTHS[sel.m - 1]} ${sel.y}`
    : `${formatDateFull(weekDates[0]).replace(/,? \d{4}$/, '')} – ${formatDateFull(weekDates[6]).replace(/,? \d{4}$/, '')}`;

  function go(dir: -1 | 1) {
    setSelected(view === 'month' ? addMonths(selected, dir).replace(/-01$/, `-${String(Math.min(sel.d, 28)).padStart(2, '0')}`) : addDays(selected, dir * 7));
  }

  function toggleType(t: EventType) {
    setTypeFilter((prev) => { const next = new Set(prev); if (next.has(t)) next.delete(t); else next.add(t); return next; });
  }

  return (
    <AdminScreen
      testID="admin-calendar"
      header={<AdminHeader title="Calendar" right={<IconButton label="Add event" Icon={Plus} dark onPress={() => setShowAdd(true)} />} />}
      refreshing={false}
      onRefresh={fetchEvents}>
      {hoas.length > 1 ? (
        <ChipRow>
          <Chip label="All communities" selected={hoaFilter === 'all'} onPress={() => setHoaFilter('all')} />
          {hoas.map((h) => <Chip key={h.id} label={h.name} selected={hoaFilter === h.id} onPress={() => setHoaFilter(h.id)} />)}
        </ChipRow>
      ) : null}

      <View style={s.navRow}>
        <IconButton label={view === 'month' ? 'Previous month' : 'Previous week'} Icon={ChevronLeft} onPress={() => go(-1)} />
        <Text style={s.navLabel} testID="calendar-label" accessibilityRole="header">{label}</Text>
        <IconButton label={view === 'month' ? 'Next month' : 'Next week'} Icon={ChevronRight} onPress={() => go(1)} />
      </View>
      <View style={s.navRow}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip testID="view-month" label="Month" selected={view === 'month'} onPress={() => setView('month')} />
          <Chip testID="view-week" label="Week" selected={view === 'week'} onPress={() => setView('week')} />
        </View>
        <Chip testID="today-btn" label="Today" selected={selected === today} onPress={() => setSelected(today)} />
      </View>

      <Card style={{ padding: 8 }}>
        <View style={s.weekRow}>
          {WEEKDAYS.map((w, i) => <Text key={i} style={s.weekday} accessibilityElementsHidden>{w}</Text>)}
        </View>
        {(view === 'month' ? weeks.map((w) => w.map((c) => ({ date: c.date, day: c.day, inMonth: c.inMonth })))
          : [weekDates.map((d) => ({ date: d, day: parseIso(d).d, inMonth: true }))]).map((row, ri) => (
          <View key={ri} style={s.weekRow}>
            {row.map((cell) => {
              const dayEvents = byDate.get(cell.date) ?? [];
              const types = [...new Set(dayEvents.map((e) => e.type))].slice(0, 3);
              const isSel = cell.date === selected;
              const isToday = cell.date === today;
              return (
                <Pressable
                  key={cell.date}
                  testID={`day-${cell.date}`}
                  onPress={() => setSelected(cell.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDateFull(cell.date)}${dayEvents.length ? `, ${dayEvents.length} events` : ''}${isToday ? ', today' : ''}`}
                  accessibilityState={{ selected: isSel }}
                  style={s.cell}>
                  <View style={[s.dayCircle, isSel && s.dayCircleSel, !isSel && isToday && s.dayCircleToday]}>
                    <Text style={[s.dayText, !cell.inMonth && { color: A.mutedDate }, isSel && { color: '#FFFFFF' }]}>{cell.day}</Text>
                  </View>
                  <View style={s.dots}>
                    {types.map((t) => <View key={t} style={[s.dot, { backgroundColor: TYPE_META[t].color }]} />)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <ChipRow>
        <Chip label="All types" selected={typeFilter.size === 0} onPress={() => setTypeFilter(new Set())} />
        {ALL_TYPES.map((t) => (
          <Chip key={t} testID={`type-${t}`} label={EVENT_TYPE_LABEL[t]} selected={typeFilter.has(t)} onPress={() => toggleType(t)} />
        ))}
      </ChipRow>

      {error ? <ErrorBlock message={error} onRetry={fetchEvents} /> : null}

      {listDates.map((date) => {
        const list = byDate.get(date) ?? [];
        return (
          <View key={date} style={{ gap: 8 }}>
            <Text style={s.dayHeading}>{date === today ? 'Today · ' : ''}{formatDateFull(date)}</Text>
            {list.length === 0 ? (
              view === 'month' || date === selected ? (
                <Card><EmptyBlock Icon={CalendarDays} title="Nothing scheduled" body={loading ? 'Loading…' : 'No events, meetings, maintenance or blockouts on this day.'} /></Card>
              ) : null
            ) : list.map((e) => {
              const { Icon, color } = TYPE_META[e.type];
              return (
                <Card key={e.id} testID={`event-${e.id}`} onPress={() => setDetail(e)} accessibilityLabel={`${EVENT_TYPE_LABEL[e.type]}: ${e.title}`} style={{ padding: 12 }}>
                  <View style={s.eventRow}>
                    <View style={[s.eventIcon, { backgroundColor: `${color}1A` }]}><Icon size={18} color={color} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                      <Text style={s.eventMeta} numberOfLines={1}>
                        {formatClock(e.startTime)}{e.endTime ? ` – ${formatClock(e.endTime)}` : ''}{e.community ? ` · ${e.community}` : ''}
                      </Text>
                    </View>
                    <Pill tone={e.type === 'blockout' ? 'error' : e.status === 'pending' ? 'warning' : 'neutral'}
                      label={(e.status === 'pending' ? 'PENDING' : EVENT_TYPE_LABEL[e.type]).toUpperCase()} />
                  </View>
                </Card>
              );
            })}
          </View>
        );
      })}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={s.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setDetail(null)} accessibilityLabel="Dismiss" />
          {detail ? (
            <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
              <View style={s.sheetHead}>
                <Pill tone={detail.type === 'blockout' ? 'error' : 'info'} label={EVENT_TYPE_LABEL[detail.type].toUpperCase()} />
                <Pressable onPress={() => setDetail(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><X size={22} color={A.text} /></Pressable>
              </View>
              <Text style={s.sheetTitle}>{detail.title}</Text>
              <Text style={s.body}>{formatDateFull(detail.date)}</Text>
              <Text style={s.body}>{formatClock(detail.startTime)}{detail.endTime ? ` – ${formatClock(detail.endTime)}` : ''}</Text>
              {detail.community ? <Text style={s.body}>{detail.community}</Text> : null}
              {detail.location ? <Text style={s.body}>{detail.location}</Text> : null}
              {detail.status ? <Text style={s.body}>Status: {detail.status}</Text> : null}
              {detail.detail ? <Text style={s.body}>{detail.detail}</Text> : null}
              {detail.type === 'blockout' ? (
                <Button label="Open amenity management" variant="secondary"
                  onPress={() => { setDetail(null); router.push({ pathname: '/(admin)/manage-amenities', params: { hoaId: detail.hoaId } }); }} />
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>

      <AddEventSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        hoas={hoas}
        zones={zones}
        userId={userId}
        defaultDate={selected}
        defaultHoa={hoaFilter === 'all' ? hoas[0]?.id ?? '' : hoaFilter}
        onCreated={(date) => { setShowAdd(false); setSelected(date); fetchEvents(); }}
      />
    </AdminScreen>
  );
}

function AddEventSheet({
  visible, onClose, hoas, zones, userId, defaultDate, defaultHoa, onCreated,
}: {
  visible: boolean; onClose: () => void; hoas: Hoa[]; zones: Map<string, string>; userId: string; defaultDate: string; defaultHoa: string;
  onCreated: (date: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [hoaId, setHoaId] = useState(defaultHoa);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('community_event');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState<string | null>('10:00');
  const [end, setEnd] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [rsvp, setRsvp] = useState(false);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setHoaId(defaultHoa); setDate(defaultDate); setTitle(''); setType('community_event'); setStart('10:00'); setEnd(null);
    setLocation(''); setDescription(''); setRsvp(false); setNotify(true); setErr(null);
  }, [visible, defaultDate, defaultHoa]);

  const dirty = title.trim() || location.trim() || description.trim();

  function close() {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    platformAlert('Discard this event?', 'Your entries have not been saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  }

  async function save() {
    if (saving) return;
    if (!title.trim()) { setErr('Enter a title.'); return; }
    if (!hoaId) { setErr('Choose a community.'); return; }
    if (!start) { setErr('Choose a start time.'); return; }
    if (end && end <= start) { setErr('End time must be after the start time.'); return; }
    if (!userId) { setErr('You are signed out.'); return; }
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from('hoa_events').insert({
      hoa_id: hoaId, created_by: userId, title: title.trim(), description: description.trim() || null,
      event_type: type, location: location.trim() || null,
      starts_at: communityWallToIso(date, start, zones.get(hoaId) ?? COMMUNITY_TIME_ZONE),
      ends_at: end ? communityWallToIso(date, end, zones.get(hoaId) ?? COMMUNITY_TIME_ZONE) : null,
      rsvp_enabled: rsvp, status: 'active',
    });
    if (error) {
      setSaving(false);
      setErr(/row-level security|permission/i.test(error.message) ? 'You do not have permission to add events to this community.' : error.message);
      return;
    }
    if (notify) {
      const { data: members, error: mErr } = await supabase.from('hoa_memberships').select('user_id').eq('hoa_id', hoaId).eq('status', 'approved');
      if (!mErr && members) {
        const rows = members.filter((m) => m.user_id !== userId).map((m) => ({
          user_id: m.user_id, hoa_id: hoaId, type: 'event_created' as const, title: `New event: ${title.trim()}`,
          body: `${formatDateFull(date)} at ${formatClock(start)}${location.trim() ? ` · ${location.trim()}` : ''}`,
        }));
        if (rows.length) {
          const { error: nErr } = await supabase.from('hoa_notifications').insert(rows);
          if (nErr) platformAlert('Event created', `The event was saved but residents could not be notified: ${nErr.message}`);
        }
      }
    }
    setSaving(false);
    onCreated(date);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: A.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.addHeader}>
          <Text style={s.sheetTitle}>New event</Text>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><X size={22} color={A.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {hoas.length > 1 ? (
            <ChipRow>{hoas.map((h) => <Chip key={h.id} label={h.name} selected={hoaId === h.id} onPress={() => setHoaId(h.id)} />)}</ChipRow>
          ) : null}
          <ChipRow>{CREATABLE.map((t) => <Chip key={t} label={EVENT_TYPE_LABEL[t]} selected={type === t} onPress={() => setType(t)} />)}</ChipRow>
          <Text style={s.label}>Title</Text>
          <TextInput testID="event-title" value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={A.textMuted} style={s.input} accessibilityLabel="Title" />
          <Text style={s.label}>Date</Text>
          <CalendarPicker selectedDate={isoToDate(date)} onSelect={(d) => setDate(dateToIso(d))}
            minDate={isoToDate(communityToday(new Date(), zones.get(hoaId)))} maxDate={isoToDate(addDays(communityToday(new Date(), zones.get(hoaId)), 730))} theme={lightTheme} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><TimePicker label="START" value={start} onChange={setStart} theme={lightTheme} /></View>
            <View style={{ flex: 1 }}><TimePicker label="END (OPTIONAL)" value={end} onChange={setEnd} theme={lightTheme} /></View>
          </View>
          <Text style={s.label}>Location (optional)</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="Clubhouse" placeholderTextColor={A.textMuted} style={s.input} accessibilityLabel="Location" />
          <Text style={s.label}>Description (optional)</Text>
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="Details residents should know" placeholderTextColor={A.textMuted}
            style={[s.input, { minHeight: 80 }]} accessibilityLabel="Description" />
          <Toggle label="Enable RSVPs" value={rsvp} onChange={setRsvp} />
          <Toggle label="Notify residents" hint="Sends an in-app notification to approved members." value={notify} onChange={setNotify} />
          {err ? <Text style={[s.body, { color: A.errorText }]} accessibilityLiveRegion="polite">{err}</Text> : null}
        </ScrollView>
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button testID="save-event" label="Create event" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navLabel: { flex: 1, textAlign: 'center', fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: A.text },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: A.textMuted, paddingVertical: 6 },
  cell: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayCircleSel: { backgroundColor: A.navy },
  dayCircleToday: { borderWidth: 2, borderColor: A.primary },
  dayText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 15, color: A.text },
  dots: { flexDirection: 'row', gap: 3, height: 8, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayHeading: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 17, color: A.text, marginTop: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: A.text },
  eventMeta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  backdrop: { flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: A.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 8 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, color: A.text },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: A.textSecondary },
  input: {
    minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, backgroundColor: A.surface,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, textAlignVertical: 'top',
  },
  addHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16,
    backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border,
  },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: A.surface, borderTopWidth: 1, borderTopColor: A.border },
});
