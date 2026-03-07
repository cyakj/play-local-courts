import React, { useState, useEffect, useMemo } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { supabase } from '@/integrations/supabase/client';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: '#00B4D8', label: 'Community Event' },
  board_meeting: { color: '#0A1628', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F59E0B', label: 'Maintenance' },
  amenity_booking: { color: '#2DD4BF', label: 'Amenity Booking' },
};

const TYPE_MAP: Record<string, string> = {
  'Community Events': 'community_event',
  'Board Meetings': 'board_meeting',
  'Amenity Bookings': 'amenity_booking',
  Maintenance: 'maintenance_scheduled',
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalEvent {
  id: string;
  community: string;
  title: string;
  type: string;
  date: string;
  day: number;
  time: string;
  location: string;
  rsvp: number | null;
}

const buildMonthGrid = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const grid: { day: number; inMonth: boolean }[] = [];

  for (let i = mondayOffset - 1; i >= 0; i--) {
    grid.push({ day: prevMonthDays - i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({ day: d, inMonth: true });
  }
  const remaining = 7 - (grid.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      grid.push({ day: d, inMonth: false });
    }
  }
  return grid;
};

const CMCalendar = () => {
  const now = new Date();
  const [communityFilter, setCommunityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { communities } = useCondoManagerCommunities();

  const communityOptions = ['All', ...communities.map(c => c.name)];
  const monthGrid = useMemo(() => buildMonthGrid(now.getFullYear(), now.getMonth()), []);

  // Fetch events from hoa_events + bookings
  useEffect(() => {
    const fetchEvents = async () => {
      if (communities.length === 0) { setLoading(false); return; }

      const hoaIds = communities.map(c => c.id);
      const hoaMap = new Map(communities.map(c => [c.id, c.name]));

      // Fetch hoa_events
      const { data: hoaEvents } = await supabase
        .from('hoa_events')
        .select('id, hoa_id, title, event_type, location, starts_at, rsvp_enabled')
        .in('hoa_id', hoaIds)
        .eq('status', 'active');

      // Get RSVP counts
      const eventIds = (hoaEvents || []).map(e => e.id);
      let rsvpCounts = new Map<string, number>();
      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('hoa_event_rsvps')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('response', 'going');
        if (rsvps) {
          for (const r of rsvps) {
            rsvpCounts.set(r.event_id, (rsvpCounts.get(r.event_id) || 0) + 1);
          }
        }
      }

      const calEvents: CalEvent[] = (hoaEvents || []).map(e => {
        const dt = new Date(e.starts_at);
        return {
          id: e.id,
          community: hoaMap.get(e.hoa_id) || '',
          title: e.title,
          type: e.event_type,
          date: `Mar ${dt.getDate()}`,
          day: dt.getDate(),
          time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          location: e.location || '',
          rsvp: e.rsvp_enabled ? (rsvpCounts.get(e.id) || 0) : null,
        };
      });

      setEvents(calEvents);
      setLoading(false);
    };
    fetchEvents();
  }, [communities]);

  const filtered = useMemo(() => events.filter(
    (e) =>
      (communityFilter === 'All' || e.community === communityFilter) &&
      (typeFilter === 'All' || e.type === TYPE_MAP[typeFilter])
  ), [events, communityFilter, typeFilter]);

  const dayEvents = filtered.filter(e => e.day === selectedDay);
  const upcomingEvents = useMemo(() =>
    filtered.filter(e => e.day > selectedDay).sort((a, b) => a.day - b.day),
    [filtered, selectedDay]
  );

  const getDotsForDay = (day: number) => {
    const dayEvts = events.filter(e => e.day === day);
    const colors = [...new Set(dayEvts.map(e => EVENT_TYPE_CONFIG[e.type]?.color).filter(Boolean))];
    return colors.slice(0, 3);
  };

  // Get current week dates
  const getWeekDates = () => {
    const today = now.getDate();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = today - mondayOffset;
    return Array.from({ length: 7 }, (_, i) => monday + i);
  };
  const weekDates = getWeekDates();

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex justify-between items-start mb-3.5">
          <div>
            <div className="text-xl font-extrabold">Calendar</div>
            <div className="text-xs opacity-65">{now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
          <div className="bg-[rgba(0,180,216,0.2)] border border-[rgba(0,180,216,0.5)] rounded-[10px] px-3.5 py-2 text-xs font-bold text-white cursor-pointer min-h-[44px] flex items-center">
            ＋ Add Event
          </div>
        </div>
        <CMChips options={communityOptions} value={communityFilter} onChange={setCommunityFilter} />
      </CMHeader>

      {/* Calendar card */}
      <div className="bg-white border-b border-cm-border px-4 py-3 flex-shrink-0">
        <div className="flex justify-end mb-2.5 gap-1">
          {(['week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setCalendarMode(mode)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition-colors"
              style={{
                background: calendarMode === mode ? '#0A1628' : '#F0F4F8',
                color: calendarMode === mode ? '#fff' : '#9CA3AF',
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {calendarMode === 'week' ? (
          <div className="flex justify-between">
            {WEEK_DAYS.map((d, i) => {
              const dt = weekDates[i];
              const isSel = dt === selectedDay;
              const dots = getDotsForDay(dt);
              return (
                <div key={d} onClick={() => setSelectedDay(dt)} className="flex-1 flex flex-col items-center gap-1 cursor-pointer">
                  <div className="text-[10px] font-bold" style={{ color: isSel ? '#00B4D8' : '#9CA3AF' }}>{d}</div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                    background: isSel ? '#0A1628' : 'transparent',
                    border: isSel ? '2px solid #00B4D8' : '2px solid transparent',
                  }}>
                    <span className="text-[13px] font-extrabold" style={{ color: isSel ? '#fff' : '#1A1A2E' }}>{dt}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {dots.length > 0 ? dots.map((c, j) => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                    )) : <div className="w-1.5 h-1.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-bold" style={{ color: '#9CA3AF' }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid.map((cell, idx) => {
                const isSel = cell.inMonth && cell.day === selectedDay;
                const isToday = cell.inMonth && cell.day === now.getDate();
                const dots = cell.inMonth ? getDotsForDay(cell.day) : [];
                return (
                  <div key={idx} onClick={() => cell.inMonth && setSelectedDay(cell.day)} className="flex flex-col items-center cursor-pointer py-0.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center relative" style={{
                      background: isSel ? '#0A1628' : 'transparent',
                      border: isSel ? '2px solid #00B4D8' : '2px solid transparent',
                    }}>
                      <span className="text-[13px] font-extrabold" style={{
                        color: !cell.inMonth ? '#E5E7EB' : isSel ? '#fff' : '#1A1A2E',
                      }}>{cell.day}</span>
                      {isToday && !isSel && (
                        <div className="absolute -bottom-0.5 w-3 h-[2px] rounded-full" style={{ background: '#00B4D8' }} />
                      )}
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((c, j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Type filter */}
      <div className="bg-white px-4 py-2 border-b border-cm-border flex-shrink-0">
        <CMChips
          options={['All', 'Community Events', 'Board Meetings', 'Amenity Bookings', 'Maintenance']}
          value={typeFilter}
          onChange={setTypeFilter}
          light
        />
      </div>

      {/* Color legend */}
      <div className="bg-white px-4 py-1.5 border-b border-cm-border flex gap-3 flex-shrink-0">
        {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
            <span className="text-[9px] text-cm-text-light">{v.label}</span>
          </div>
        ))}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-3 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="text-xs font-bold text-cm-text-light mb-2.5 tracking-wider uppercase">
              {now.toLocaleString('en-US', { month: 'short' })} {selectedDay} Events
            </div>

            {dayEvents.length === 0 && (
              <div className="text-center py-8 text-cm-text-light">No events on this day</div>
            )}

            {dayEvents.map((e) => {
              const cfg = EVENT_TYPE_CONFIG[e.type] || { color: '#ccc', label: '' };
              return (
                <div key={e.id} className="bg-white rounded-[14px] p-3.5 mb-2.5 border border-cm-border flex gap-3">
                  <div className="w-1 rounded-full flex-shrink-0 min-h-[50px]" style={{ background: cfg.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div className="text-sm font-extrabold text-cm-text">{e.title}</div>
                      {e.rsvp !== null && (
                        <div className="bg-cm-cyan-light text-cm-cyan text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {e.rsvp} Going
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-cm-cyan font-semibold mt-1">{e.community}</div>
                    <div className="text-xs text-cm-text-mid mt-1">{e.time} · {e.location}</div>
                    <div className="mt-2 flex gap-2">
                      <div className="rounded-lg px-3 py-1 text-[11px] font-bold cursor-pointer min-h-[44px] flex items-center"
                        style={{ background: `${cfg.color}18`, color: cfg.color }}>
                        View Details
                      </div>
                      {e.rsvp !== null && (
                        <div className="bg-cm-navy text-white rounded-lg px-3 py-1 text-[11px] font-bold cursor-pointer min-h-[44px] flex items-center">
                          RSVP
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {upcomingEvents.length > 0 && (
              <>
                <div className="text-xs font-bold mt-4 mb-2.5 tracking-[0.8px] uppercase" style={{ color: '#9CA3AF' }}>
                  Upcoming This Month
                </div>
                {upcomingEvents.map((e) => {
                  const cfg = EVENT_TYPE_CONFIG[e.type] || { color: '#ccc', label: '' };
                  return (
                    <div key={e.id} className="bg-white rounded-xl py-2.5 px-3 mb-2 border border-cm-border flex gap-2.5">
                      <div className="w-1 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                      <div>
                        <div className="text-[13px] font-bold text-cm-text">{e.title}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                          {e.date} · {e.time} · {e.community}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CMCalendar;
