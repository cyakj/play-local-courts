import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface Hoa {
  id: string;
  name: string;
}

interface HoaEvent {
  id: string;
  hoa_id: string;
  title: string;
  event_type: string;
  location: string | null;
  starts_at: string;
  rsvp_enabled: boolean | null;
}

const EVENT_COLORS: Record<string, string> = {
  community_event: Colors.accentCyan,
  board_meeting: Colors.navy,
  maintenance_scheduled: Colors.coral,
};

function eventColor(type: string): string {
  return EVENT_COLORS[type] ?? Colors.textMuted;
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    community_event: 'Community Event',
    board_meeting: 'Board Meeting',
    maintenance_scheduled: 'Maintenance',
  };
  return map[type] ?? type;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const EVENT_TYPES = ['community_event', 'board_meeting', 'maintenance_scheduled'] as const;

export default function CMCalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [hoas, setHoas] = useState<Hoa[]>([]);
  const [selectedHoaId, setSelectedHoaId] = useState<string | null>(null);
  const [events, setEvents] = useState<HoaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HoaEvent | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add event form state
  const [currentUserId, setCurrentUserId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<typeof EVENT_TYPES[number]>('community_event');
  const [newLocation, setNewLocation] = useState('');
  const [newDate, setNewDate] = useState(isoDate(today));
  const [newTime, setNewTime] = useState('10:00');
  const [newHoaId, setNewHoaId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: hoaData } = await supabase.from('hoas').select('id, name').order('name');
      const h = hoaData ?? [];
      setHoas(h);
      if (h.length > 0) setNewHoaId(h[0].id);

      const hoaIds = h.map((x) => x.id);
      if (hoaIds.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from('hoa_events')
        .select('id, hoa_id, title, event_type, location, starts_at, rsvp_enabled')
        .in('hoa_id', hoaIds)
        .order('starts_at');
      setEvents(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const filteredEvents = selectedHoaId
    ? events.filter((e) => e.hoa_id === selectedHoaId)
    : events;

  const eventMap: Record<string, HoaEvent[]> = {};
  filteredEvents.forEach((e) => {
    const d = e.starts_at.split('T')[0];
    if (!eventMap[d]) eventMap[d] = [];
    eventMap[d].push(e);
  });

  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);
  const selectedEvents = selectedDay ? (eventMap[selectedDay] ?? []) : [];

  async function saveEvent() {
    if (!newTitle.trim() || !newHoaId) return;
    setSaving(true);
    await supabase.from('hoa_events').insert({
      hoa_id: newHoaId,
      title: newTitle.trim(),
      event_type: newType,
      location: newLocation.trim() || null,
      starts_at: `${newDate}T${newTime}:00`,
      rsvp_enabled: false,
      created_by: currentUserId,
    });
    // reload events
    const hoaIds = hoas.map((x) => x.id);
    const { data } = await supabase
      .from('hoa_events')
      .select('id, hoa_id, title, event_type, location, starts_at, rsvp_enabled')
      .in('hoa_id', hoaIds)
      .order('starts_at');
    setEvents(data ?? []);
    setSaving(false);
    setAddModalOpen(false);
    setNewTitle('');
    setNewLocation('');
    setNewDate(isoDate(today));
    setNewTime('10:00');
    setNewType('community_event');
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title="Calendar"
        rightIcon={
          <TouchableOpacity onPress={() => setAddModalOpen(true)}>
            <Plus color={Colors.white} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Community filter */}
          {hoas.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
              <TouchableOpacity
                style={[styles.filterPill, !selectedHoaId && styles.filterPillActive]}
                onPress={() => setSelectedHoaId(null)}>
                <Text style={[styles.filterLabel, !selectedHoaId && styles.filterLabelActive]}>All</Text>
              </TouchableOpacity>
              {hoas.map((h) => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.filterPill, selectedHoaId === h.id && styles.filterPillActive]}
                  onPress={() => setSelectedHoaId(h.id)}>
                  <Text style={[styles.filterLabel, selectedHoaId === h.id && styles.filterLabelActive]}>{h.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <ChevronLeft color={Colors.navy} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <ChevronRight color={Colors.navy} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          {loading ? (
            <CardSkeleton />
          ) : (
            <View style={styles.grid}>
              {Array.from({ length: startOffset }).map((_, i) => (
                <View key={`e-${i}`} style={styles.dayCell} />
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const dayNum = i + 1;
                const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = iso === isoDate(today);
                const isSelected = iso === selectedDay;
                const dayEvents = eventMap[iso] ?? [];
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]}
                    onPress={() => setSelectedDay(isSelected ? null : iso)}>
                    <Text style={[styles.dayNum, isToday && !isSelected && styles.dayNumToday, isSelected && styles.dayNumSelected]}>
                      {dayNum}
                    </Text>
                    {dayEvents.length > 0 && (
                      <View style={styles.dotRow}>
                        {dayEvents.slice(0, 3).map((e, di) => (
                          <View key={di} style={[styles.dot, { backgroundColor: eventColor(e.event_type) }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Selected day events */}
          {selectedDay && (
            <View style={styles.daySection}>
              <Text style={styles.daySectionTitle}>
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={styles.noEvents}>No events this day.</Text>
              ) : (
                selectedEvents.map((e) => (
                  <TouchableOpacity key={e.id} style={styles.eventRow} onPress={() => setSelectedEvent(e)}>
                    <View style={[styles.eventDot, { backgroundColor: eventColor(e.event_type) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Text style={styles.eventMeta}>
                        {eventLabel(e.event_type)}{e.location ? ` · ${e.location}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Upcoming events list when no day selected */}
          {!selectedDay && !loading && (
            <>
              <Text style={styles.upcomingTitle}>Upcoming Events</Text>
              {filteredEvents.filter((e) => e.starts_at >= new Date().toISOString()).length === 0 ? (
                <EmptyState icon={null} title="No upcoming events" subtitle="Tap + to add a community event." />
              ) : (
                filteredEvents
                  .filter((e) => e.starts_at >= new Date().toISOString())
                  .slice(0, 10)
                  .map((e) => (
                    <TouchableOpacity key={e.id} style={styles.eventRow} onPress={() => setSelectedEvent(e)}>
                      <View style={[styles.eventDot, { backgroundColor: eventColor(e.event_type) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle}>{e.title}</Text>
                        <Text style={styles.eventMeta}>
                          {new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {' · '}{hoas.find((h) => h.id === e.hoa_id)?.name ?? ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Event detail modal */}
      <Modal visible={!!selectedEvent} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedEvent(null)}>
        {selectedEvent && (
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
              <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                <X color={Colors.textMuted} size={22} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={[styles.typePill, { backgroundColor: eventColor(selectedEvent.event_type) + '20' }]}>
                <Text style={[styles.typePillText, { color: eventColor(selectedEvent.event_type) }]}>
                  {eventLabel(selectedEvent.event_type)}
                </Text>
              </View>
              <Text style={styles.modalField}>DATE & TIME</Text>
              <Text style={styles.modalValue}>
                {new Date(selectedEvent.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {'\n'}
                {new Date(selectedEvent.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
              {selectedEvent.location && (
                <>
                  <Text style={[styles.modalField, { marginTop: 16 }]}>LOCATION</Text>
                  <Text style={styles.modalValue}>{selectedEvent.location}</Text>
                </>
              )}
              <Text style={[styles.modalField, { marginTop: 16 }]}>COMMUNITY</Text>
              <Text style={styles.modalValue}>{hoas.find((h) => h.id === selectedEvent.hoa_id)?.name ?? '—'}</Text>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Add event modal */}
      <Modal visible={addModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddModalOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Event</Text>
            <TouchableOpacity onPress={() => setAddModalOpen(false)}>
              <X color={Colors.textMuted} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput
              style={styles.textInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor={Colors.textPlaceholder}
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TYPE</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePillBtn, newType === t && styles.typePillBtnActive]}
                  onPress={() => setNewType(t)}>
                  <Text style={[styles.typePillBtnLabel, newType === t && styles.typePillBtnLabelActive]}>
                    {eventLabel(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {hoas.length > 1 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>COMMUNITY</Text>
                <View style={styles.typeRow}>
                  {hoas.map((h) => (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.typePillBtn, newHoaId === h.id && styles.typePillBtnActive]}
                      onPress={() => setNewHoaId(h.id)}>
                      <Text style={[styles.typePillBtnLabel, newHoaId === h.id && styles.typePillBtnLabelActive]}>
                        {h.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={newDate}
              onChangeText={setNewDate}
              placeholder="2026-06-01"
              placeholderTextColor={Colors.textPlaceholder}
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TIME (HH:MM)</Text>
            <TextInput
              style={styles.textInput}
              value={newTime}
              onChangeText={setNewTime}
              placeholder="10:00"
              placeholderTextColor={Colors.textPlaceholder}
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>LOCATION (OPTIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={newLocation}
              onChangeText={setNewLocation}
              placeholder="Clubhouse, Court 1, etc."
              placeholderTextColor={Colors.textPlaceholder}
            />

            <View style={{ marginTop: 28 }}>
              <Button
                variant="accent"
                label="Save Event"
                onPress={saveEvent}
                loading={saving}
                disabled={!newTitle.trim()}
                fullWidth
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  content: { padding: Spacing.pagePx, paddingBottom: 80 },
  filterScroll: { marginBottom: 16 },
  filterContent: { gap: 8, paddingRight: 8 },
  filterPill: {
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.cardBg,
  },
  filterPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  filterLabelActive: { color: Colors.white },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 8 },
  monthLabel: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy },
  dayHeaders: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayCellSelected: { backgroundColor: Colors.navy },
  dayCellToday: { backgroundColor: 'rgba(0,212,255,0.12)' },
  dayNum: { fontFamily: FontFamily.interSemiBold, fontSize: 14, color: Colors.textPrimary },
  dayNumToday: { color: Colors.accentCyan },
  dayNumSelected: { color: Colors.white },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  daySection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  daySectionTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.cardTitle, color: Colors.navy, marginBottom: 12 },
  noEvents: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textMuted },
  upcomingTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, marginTop: 24, marginBottom: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  eventTitle: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  eventMeta: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted, marginTop: 2 },
  modal: { flex: 1, backgroundColor: Colors.cardBg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, flex: 1, marginRight: 12 },
  modalBody: { padding: Spacing.pagePx },
  typePill: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 20 },
  typePillText: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel },
  modalField: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 4 },
  modalValue: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: Colors.navy },
  fieldLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  textInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input,
    padding: 12, fontFamily: FontFamily.interRegular, fontSize: FontSize.body,
    color: Colors.textPrimary, backgroundColor: Colors.pageBg,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePillBtn: {
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.cardBg,
  },
  typePillBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typePillBtnLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  typePillBtnLabelActive: { color: Colors.white },
});
