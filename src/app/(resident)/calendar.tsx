import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

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
  amenity_booking: Colors.accentCyan,
};

function eventColor(type: string): string {
  return EVENT_COLORS[type] ?? Colors.textMuted;
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    community_event: 'Community',
    board_meeting: 'Board Meeting',
    maintenance_scheduled: 'Maintenance',
    amenity_booking: 'Booking',
  };
  return map[type] ?? type;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function ResidentCalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<HoaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HoaEvent | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: memberships } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id);
      const hoaIds = (memberships ?? []).map((m) => m.hoa_id);
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

  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  const eventMap: Record<string, HoaEvent[]> = {};
  events.forEach((e) => {
    const d = e.starts_at.split('T')[0];
    if (!eventMap[d]) eventMap[d] = [];
    eventMap[d].push(e);
  });

  const selectedEvents = selectedDay ? (eventMap[selectedDay] ?? []) : [];

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Calendar" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <ChevronLeft color={Colors.navy} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <ChevronRight color={Colors.navy} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayHeaders}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {loading ? (
            <CardSkeleton />
          ) : (
            <View style={styles.grid}>
              {Array.from({ length: startOffset }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCell} />
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

          {selectedDay && (
            <View style={styles.dayEventsSection}>
              <Text style={styles.dayEventsTitle}>
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

          {!selectedDay && (
            <>
              <Text style={styles.upcomingTitle}>Upcoming Events</Text>
              {loading ? (
                <CardSkeleton />
              ) : events.filter((e) => e.starts_at >= new Date().toISOString()).length === 0 ? (
                <EmptyState icon={null} title="No upcoming events" subtitle="Your HOA hasn't scheduled any events yet." />
              ) : (
                events
                  .filter((e) => e.starts_at >= new Date().toISOString())
                  .slice(0, 10)
                  .map((e) => (
                    <TouchableOpacity key={e.id} style={styles.eventRow} onPress={() => setSelectedEvent(e)}>
                      <View style={[styles.eventDot, { backgroundColor: eventColor(e.event_type) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle}>{e.title}</Text>
                        <Text style={styles.eventMeta}>
                          {new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {e.location ? ` · ${e.location}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </>
          )}
        </View>
      </ScrollView>

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
              <View style={[styles.eventTypePill, { backgroundColor: eventColor(selectedEvent.event_type) + '20' }]}>
                <Text style={[styles.eventTypePillText, { color: eventColor(selectedEvent.event_type) }]}>
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
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  content: { padding: Spacing.pagePx, paddingBottom: 80 },
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
  dayEventsSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  dayEventsTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.cardTitle, color: Colors.navy, marginBottom: 12 },
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
  eventTypePill: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 20 },
  eventTypePillText: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel },
  modalField: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 4 },
  modalValue: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: Colors.navy },
});
