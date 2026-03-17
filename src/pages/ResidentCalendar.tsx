import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CalendarCommunityChips from '@/components/resident/CalendarCommunityChips';
import CalendarEventTypeChips from '@/components/resident/CalendarEventTypeChips';
import CalendarLegend from '@/components/resident/CalendarLegend';
import CalendarEventDetail from '@/components/resident/CalendarEventDetail';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: '#00B4D8', label: 'Community Event' },
  board_meeting: { color: '#0A1628', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F59E0B', label: 'Maintenance' },
  amenity_booking: { color: '#2DD4BF', label: 'Amenity Booking' },
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  location: string | null;
  starts_at: string;
  hoa_id: string;
  community_name?: string;
  description?: string | null;
}

interface Community {
  hoaId: string;
  name: string;
}

const buildMonthGrid = (year: number, month: number) => {
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
};

const getWeekDates = (baseDate: Date) => {
  const d = new Date(baseDate);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
};

const ResidentCalendar = () => {
  const now = new Date();
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [weekBase, setWeekBase] = useState(now);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunity, setActiveCommunity] = useState('all');
  const [activeEventType, setActiveEventType] = useState('all');
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  const monthGrid = useMemo(
    () => buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );
  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);

  // Fetch communities
  useEffect(() => {
    const fetchCommunities = async () => {
      if (!currentUser?.id) return;
      const { data } = await supabase
        .from('hoa_memberships')
        .select('hoa_id, hoas(name)')
        .eq('user_id', currentUser.id)
        .eq('status', 'approved');
      if (data) {
        setCommunities(
          data.map((m: any) => ({ hoaId: m.hoa_id, name: m.hoas?.name || 'Community' }))
        );
      }
    };
    fetchCommunities();
  }, [currentUser?.id]);

  // Fetch events + bookings
  useEffect(() => {
    const fetchAll = async () => {
      if (!currentUser?.id || communities.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const hoaIds = communities.map(c => c.hoaId);
      const hoaNameMap = new Map(communities.map(c => [c.hoaId, c.name]));

      // HOA events
      const { data: hoaEvents } = await supabase
        .from('hoa_events')
        .select('id, title, event_type, location, starts_at, hoa_id, description')
        .in('hoa_id', hoaIds)
        .eq('status', 'active')
        .order('starts_at');

      const mapped: CalendarEvent[] = (hoaEvents || []).map(e => ({
        ...e,
        community_name: hoaNameMap.get(e.hoa_id) || '',
        location: e.location || null,
      }));

      // Resident's own bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, date, start_time, end_time, court_id, courts(name, hoa_id)')
        .eq('user_id', currentUser.id)
        .eq('status', 'confirmed');

      if (bookings) {
        for (const b of bookings) {
          const court = (b as any).courts;
          if (!court) continue;
          const hoaId = court.hoa_id;
          if (!hoaIds.includes(hoaId)) continue;
          const startHour = b.start_time?.slice(0, 5) || '';
          const endHour = b.end_time?.slice(0, 5) || '';
          const fmtTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
          };
          mapped.push({
            id: b.id,
            title: `${court.name} · ${fmtTime(startHour)} – ${fmtTime(endHour)}`,
            event_type: 'amenity_booking',
            location: court.name,
            starts_at: `${b.date}T${b.start_time}`,
            hoa_id: hoaId,
            community_name: hoaNameMap.get(hoaId) || '',
            description: null,
          });
        }
      }

      mapped.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      setEvents(mapped);
      setLoading(false);
    };
    fetchAll();
  }, [currentUser?.id, communities]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (activeCommunity !== 'all' && e.hoa_id !== activeCommunity) return false;
      if (activeEventType !== 'all' && e.event_type !== activeEventType) return false;
      return true;
    });
  }, [events, activeCommunity, activeEventType]);

  const getDotsForDay = (year: number, month: number, day: number) => {
    const dayEvts = filteredEvents.filter(e => {
      const d = new Date(e.starts_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    return [...new Set(dayEvts.map(e => EVENT_TYPE_CONFIG[e.event_type]?.color).filter(Boolean))].slice(0, 3);
  };

  const dayEvents = filteredEvents.filter(e => {
    const d = new Date(e.starts_at);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && d.getDate() === selectedDay;
  });

  const handleSelectDay = (year: number, month: number, day: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedDay(day);
  };

  const navigateMonth = (dir: number) => {
    const m = new Date(currentMonth);
    m.setMonth(m.getMonth() + dir);
    setCurrentMonth(m);
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7 * dir);
    setWeekBase(d);
  };

  const displayMonth = viewMode === 'month' ? currentMonth : weekDates[3]; // mid-week for display

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="navy-gradient text-white px-5 pt-[50px] pb-4">
        <div className="text-xl font-extrabold">Calendar</div>
        <div className="text-xs opacity-65 mt-0.5">
          {displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Community chips + Week/Month toggle */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <CalendarCommunityChips
            communities={communities}
            activeCommunity={activeCommunity}
            onSelect={setActiveCommunity}
          />
        </div>
        <div className="flex flex-shrink-0 rounded-full overflow-hidden border border-border">
          {(['week', 'month'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="text-[10px] font-bold px-3 py-1.5 transition-colors capitalize"
              style={{
                background: viewMode === mode ? 'hsl(var(--navy))' : 'hsl(var(--card))',
                color: viewMode === mode ? '#fff' : 'hsl(var(--muted-foreground))',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      <div className="bg-card mx-4 mt-3 rounded-2xl p-4 border border-border">
        {viewMode === 'month' ? (
          <>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => navigateMonth(-1)} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-bold text-foreground">
                {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => navigateMonth(1)} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-bold text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid.map((cell, idx) => {
                const cellYear = currentMonth.getFullYear();
                const cellMonth = currentMonth.getMonth();
                const isSel = cell.inMonth && cell.day === selectedDay && cellMonth === selectedMonth && cellYear === selectedYear;
                const isToday = cell.inMonth && cell.day === now.getDate() && cellMonth === now.getMonth() && cellYear === now.getFullYear();
                const dots = cell.inMonth ? getDotsForDay(cellYear, cellMonth, cell.day) : [];
                return (
                  <div
                    key={idx}
                    onClick={() => cell.inMonth && handleSelectDay(cellYear, cellMonth, cell.day)}
                    className="flex flex-col items-center cursor-pointer py-0.5"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center relative"
                      style={{
                        background: isSel ? 'hsl(var(--navy))' : 'transparent',
                        border: isSel ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                      }}
                    >
                      <span
                        className="text-[13px] font-extrabold"
                        style={{
                          color: !cell.inMonth ? 'hsl(var(--border))' : isSel ? '#fff' : 'hsl(var(--foreground))',
                        }}
                      >
                        {cell.day}
                      </span>
                      {isToday && !isSel && dots.length === 0 && <div className="absolute -bottom-0.5 w-3 h-[2px] rounded-full bg-primary" />}
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((c, j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Week nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateWeek(-1)} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-bold text-foreground">
                {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <button onClick={() => navigateWeek(1)} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date, i) => {
                const isSel = date.getDate() === selectedDay && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
                const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                const dots = getDotsForDay(date.getFullYear(), date.getMonth(), date.getDate());
                return (
                  <div
                    key={i}
                    onClick={() => handleSelectDay(date.getFullYear(), date.getMonth(), date.getDate())}
                    className="flex flex-col items-center cursor-pointer py-1"
                  >
                    <div className="text-[10px] font-bold text-muted-foreground mb-1">{WEEK_DAYS[i]}</div>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center relative"
                      style={{
                        background: isSel ? 'hsl(var(--navy))' : 'transparent',
                        border: isSel ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                      }}
                    >
                      <span
                        className="text-[13px] font-extrabold"
                        style={{ color: isSel ? '#fff' : 'hsl(var(--foreground))' }}
                      >
                        {date.getDate()}
                      </span>
                      {isToday && !isSel && <div className="absolute -bottom-0.5 w-3 h-[2px] rounded-full bg-primary" />}
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((c, j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Event type chips */}
      <div className="px-4 mt-3">
        <CalendarEventTypeChips activeType={activeEventType} onSelect={setActiveEventType} />
      </div>

      {/* Legend */}
      <div className="px-4 mt-3">
        <CalendarLegend />
      </div>

      {/* Day events */}
      <div className="px-4 mt-4">
        <div className="text-xs font-bold text-muted-foreground mb-2.5 tracking-wider uppercase">
          {new Date(selectedYear, selectedMonth, selectedDay).toLocaleString('en-US', { month: 'short' })} {selectedDay} Events
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : dayEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No events on this day</div>
        ) : (
          dayEvents.map(e => {
            const cfg = EVENT_TYPE_CONFIG[e.event_type] || { color: '#ccc', label: '' };
            const dt = new Date(e.starts_at);
            return (
              <div
                key={e.id}
                onClick={() => setDetailEvent(e)}
                className="bg-card rounded-2xl p-4 mb-3 border border-border flex gap-3 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="w-1 rounded-full flex-shrink-0 min-h-[50px]" style={{ background: cfg.color }} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">{e.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    {e.location && ` · ${e.location}`}
                  </div>
                  {e.community_name && (
                    <div className="text-[10px] text-muted-foreground mt-1 opacity-70">{e.community_name}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Event Detail Sheet */}
      {detailEvent && (
        <CalendarEventDetail event={detailEvent} onClose={() => setDetailEvent(null)} />
      )}
    </div>
  );
};

export default ResidentCalendar;
