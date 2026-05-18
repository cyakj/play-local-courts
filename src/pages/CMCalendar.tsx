import React, { useState, useEffect, useMemo } from 'react';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event:       { color: '#00D4FF', label: 'Community Event' },
  board_meeting:         { color: '#0F1F3D', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F97066', label: 'Maintenance' },
};

const TYPE_LABELS = ['All', 'Community Events', 'Board Meetings', 'Maintenance'];

const TYPE_MAP: Record<string, string> = {
  'Community Events': 'community_event',
  'Board Meetings': 'board_meeting',
  Maintenance: 'maintenance_scheduled',
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalEvent {
  id: string;
  community: string;
  communityId: string;
  title: string;
  type: string;
  date: string;
  day: number;
  month: number;
  year: number;
  time: string;
  location: string;
  rsvp: number | null;
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

// Scrollable pill filter tabs
const PillTabs: React.FC<{
  options: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
    <div className="flex gap-2 pb-1" style={{ whiteSpace: 'nowrap' }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="flex-shrink-0 active:scale-95 transition-transform"
            style={{
              padding: '8px 16px',
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              border: active ? 'none' : '1px solid #0F1F3D',
              background: active ? '#FFFFFF' : '#0F1F3D',
              color: active ? '#0F1F3D' : '#FFFFFF',
              cursor: 'pointer',
              minHeight: 36,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

// Form input style
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(15,31,61,0.15)',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 14,
  color: '#0F1F3D',
  fontFamily: 'Inter, sans-serif',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
};

const CMCalendar = () => {
  const now = new Date();
  const { currentUser } = useAuth();
  const [communityFilter, setCommunityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const { communities } = useCondoManagerCommunities();

  // Add Event form state
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState('community_event');
  const [evDate, setEvDate] = useState('');
  const [evStartTime, setEvStartTime] = useState('');
  const [evEndTime, setEvEndTime] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evRsvp, setEvRsvp] = useState(false);
  const [evNotify, setEvNotify] = useState(true);
  const [evCommunityId, setEvCommunityId] = useState('');
  const [creating, setCreating] = useState(false);

  const communityOptions = ['All', ...communities.map(c => c.name)];
  const monthGrid = useMemo(
    () => buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  // Week dates
  const weekDates = useMemo(() => {
    const base = new Date(selectedYear, selectedMonth, selectedDay);
    const day = base.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDay, selectedMonth, selectedYear]);

  const fetchEvents = async () => {
    if (communities.length === 0) { setLoading(false); return; }
    const hoaIds = communities.map(c => c.id);
    const hoaMap = new Map(communities.map(c => [c.id, c.name]));

    const { data: hoaEvents } = await supabase
      .from('hoa_events')
      .select('id, hoa_id, title, event_type, location, starts_at, rsvp_enabled')
      .in('hoa_id', hoaIds)
      .eq('status', 'active');

    const eventIds = (hoaEvents || []).map(e => e.id);
    const rsvpCounts = new Map<string, number>();
    if (eventIds.length > 0) {
      const { data: rsvps } = await supabase
        .from('hoa_event_rsvps')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('response', 'going');
      if (rsvps) for (const r of rsvps) rsvpCounts.set(r.event_id, (rsvpCounts.get(r.event_id) || 0) + 1);
    }

    const calEvents: CalEvent[] = (hoaEvents || []).map(e => {
      const dt = new Date(e.starts_at);
      return {
        id: e.id,
        community: hoaMap.get(e.hoa_id) || '',
        communityId: e.hoa_id,
        title: e.title,
        type: e.event_type,
        date: `${dt.toLocaleString('en-US', { month: 'short' })} ${dt.getDate()}`,
        day: dt.getDate(),
        month: dt.getMonth(),
        year: dt.getFullYear(),
        time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        location: e.location || '',
        rsvp: e.rsvp_enabled ? (rsvpCounts.get(e.id) || 0) : null,
      };
    });

    setEvents(calEvents);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [communities]);

  useEffect(() => {
    if (communities.length > 0 && !evCommunityId) setEvCommunityId(communities[0].id);
  }, [communities, evCommunityId]);

  const handleCreateEvent = async () => {
    if (!evTitle.trim() || !evDate || !evStartTime || !evCommunityId || !currentUser?.id) return;
    setCreating(true);
    const startsAt = new Date(`${evDate}T${evStartTime}`).toISOString();
    const endsAt = evEndTime ? new Date(`${evDate}T${evEndTime}`).toISOString() : null;

    const { error } = await supabase.from('hoa_events').insert({
      hoa_id: evCommunityId,
      created_by: currentUser.id,
      title: evTitle.trim(),
      description: evDescription.trim() || null,
      event_type: evType,
      location: evLocation.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      rsvp_enabled: evRsvp,
    });

    if (error) { toast.error('Failed to create event'); setCreating(false); return; }

    if (evNotify) {
      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .eq('hoa_id', evCommunityId)
        .eq('status', 'approved');
      if (members) {
        const eventNotifs = members
          .filter((m: any) => m.user_id !== currentUser.id)
          .map((m: any) => ({
            user_id: m.user_id,
            hoa_id: evCommunityId,
            type: 'event_created' as const,
            title: `New event: ${evTitle.trim()}`,
            body: `${evDate} at ${evStartTime}${evLocation ? ` · ${evLocation}` : ''}`,
          }));
        if (eventNotifs.length > 0) await supabase.from('hoa_notifications').insert(eventNotifs);
      }
    }

    toast.success('Event added');
    setShowAddEvent(false);
    setEvTitle(''); setEvDate(''); setEvStartTime(''); setEvEndTime('');
    setEvLocation(''); setEvDescription(''); setEvRsvp(false); setEvNotify(true);
    setCreating(false);
    fetchEvents();
  };

  const filtered = useMemo(() => events.filter(
    e =>
      (communityFilter === 'All' || e.community === communityFilter) &&
      (typeFilter === 'All' || e.type === TYPE_MAP[typeFilter])
  ), [events, communityFilter, typeFilter]);

  const dayEvents = filtered.filter(e => e.day === selectedDay && e.month === selectedMonth && e.year === selectedYear);

  const getDotsForDay = (year: number, month: number, day: number) => {
    const dayEvts = filtered.filter(e => e.year === year && e.month === month && e.day === day);
    return [...new Set(dayEvts.map(e => EVENT_TYPE_CONFIG[e.type]?.color).filter(Boolean))].slice(0, 3);
  };

  const navigateMonth = (dir: number) => {
    const m = new Date(currentMonth);
    m.setMonth(m.getMonth() + dir);
    setCurrentMonth(m);
  };

  const displayMonth = viewMode === 'month' ? currentMonth : (weekDates[3] || now);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9FAFB' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D', flexShrink: 0 }} className="px-5 pt-12 pb-5">
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-[28px] font-black text-white leading-[1.1] tracking-tight"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Calendar
          </h1>
          <div className="flex items-center gap-2">
            {/* Week/Month toggle */}
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              {(['week', 'month'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-3 py-1.5 text-[12px] font-bold capitalize transition-colors"
                  style={{
                    background: viewMode === mode ? 'rgba(0,212,255,0.3)' : 'transparent',
                    color: viewMode === mode ? '#fff' : 'rgba(255,255,255,0.6)',
                    border: 'none',
                    cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif' }}>
          {displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </p>

        {/* Community filter chips */}
        <div className="mt-3">
          <PillTabs options={communityOptions} value={communityFilter} onChange={setCommunityFilter} />
        </div>
      </div>

      {/* Calendar card */}
      <div
        className="mx-4 mt-4 rounded-2xl overflow-hidden"
        style={{
          background: 'white',
          boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)',
          border: '1px solid rgba(15,31,61,0.06)',
          flexShrink: 0,
        }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={() => viewMode === 'month' ? navigateMonth(-1) : undefined}
            className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ background: '#F9FAFB', border: 'none', cursor: 'pointer' }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" style={{ color: '#4B5563' }} />
          </button>
          <span className="text-[14px] font-bold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
            {viewMode === 'month'
              ? currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })
              : `${weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            }
          </span>
          <button
            onClick={() => viewMode === 'month' ? navigateMonth(1) : undefined}
            className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ background: '#F9FAFB', border: 'none', cursor: 'pointer' }}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" style={{ color: '#4B5563' }} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3 mb-1">
          {WEEK_DAYS.map(d => (
            <div
              key={d}
              className="text-center"
              style={{ fontSize: 12, fontWeight: 600, color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="px-3 pb-4">
          {viewMode === 'month' ? (
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid.map((cell, idx) => {
                const cy = currentMonth.getFullYear();
                const cm = currentMonth.getMonth();
                const isSel = cell.inMonth && cell.day === selectedDay && cm === selectedMonth && cy === selectedYear;
                const isToday = cell.inMonth && cell.day === now.getDate() && cm === now.getMonth() && cy === now.getFullYear();
                const dots = cell.inMonth ? getDotsForDay(cy, cm, cell.day) : [];
                const isWeekend = idx % 7 >= 5;
                return (
                  <div
                    key={idx}
                    onClick={() => cell.inMonth && (() => { setSelectedDay(cell.day); setSelectedMonth(cm); setSelectedYear(cy); })()}
                    className="flex flex-col items-center cursor-pointer py-0.5"
                  >
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        background: isSel ? '#0F1F3D' : isToday ? 'rgba(0,212,255,0.1)' : 'transparent',
                        border: isSel ? '2px solid #00D4FF' : '2px solid transparent',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          fontFamily: 'Manrope, sans-serif',
                          color: !cell.inMonth ? '#D1D5DB' : isSel ? '#FFFFFF' : isWeekend ? '#4B5563' : '#0F1F3D',
                        }}
                      >
                        {cell.day}
                      </span>
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((c, j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date, i) => {
                const isSel = date.getDate() === selectedDay && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
                const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                const dots = getDotsForDay(date.getFullYear(), date.getMonth(), date.getDate());
                return (
                  <div
                    key={i}
                    onClick={() => { setSelectedDay(date.getDate()); setSelectedMonth(date.getMonth()); setSelectedYear(date.getFullYear()); }}
                    className="flex flex-col items-center cursor-pointer py-1"
                  >
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        background: isSel ? '#0F1F3D' : isToday ? 'rgba(0,212,255,0.1)' : 'transparent',
                        border: isSel ? '2px solid #00D4FF' : '2px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'Manrope, sans-serif', color: isSel ? '#FFFFFF' : '#0F1F3D' }}>
                        {date.getDate()}
                      </span>
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((c, j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Event type filter */}
      <div className="px-4 mt-4" style={{ flexShrink: 0 }}>
        <PillTabs options={TYPE_LABELS} value={typeFilter} onChange={setTypeFilter} />
      </div>

      {/* Legend */}
      <div className="px-4 mt-3 flex flex-wrap gap-x-4 gap-y-1.5" style={{ flexShrink: 0 }}>
        {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: v.color }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Events list */}
      <div className="flex-1 px-4 pt-4 pb-28">
        {/* Section header */}
        <div
          className="mb-3 uppercase"
          style={{ fontSize: 13, fontWeight: 700, color: '#0F1F3D', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}
        >
          {new Date(selectedYear, selectedMonth, selectedDay).toLocaleString('en-US', { month: 'short' })} {selectedDay} Events
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
          </div>
        ) : dayEvents.length === 0 ? (
          <div className="text-center py-8" style={{ fontSize: 14, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
            No events on this day
          </div>
        ) : (
          dayEvents.map(e => {
            const cfg = EVENT_TYPE_CONFIG[e.type] || { color: '#8892A4', label: '' };
            return (
              <div
                key={e.id}
                className="bg-white rounded-[12px] p-4 mb-2.5 flex gap-3"
                style={{
                  boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 8px 16px rgba(15,31,61,0.04)',
                  border: '1px solid rgba(15,31,61,0.06)',
                  borderLeft: `3px solid ${cfg.color}`,
                }}
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="font-semibold"
                      style={{ fontSize: 15, color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
                    >
                      {e.title}
                    </div>
                    {e.rsvp !== null && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: '#E0F9FF', color: '#0369A1', border: '1px solid #00D4FF' }}
                      >
                        {e.rsvp} Going
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5" style={{ fontSize: 13, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
                    {e.time}{e.location ? ` · ${e.location}` : ''}
                  </div>
                  <div className="mt-0.5" style={{ fontSize: 12, color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
                    {e.community}
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full"
                      style={{ background: `${cfg.color}18`, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Add Event button */}
      <button
        onClick={() => setShowAddEvent(true)}
        className="fixed right-5 flex items-center justify-center rounded-full active:scale-95 transition-transform z-40"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          width: 56,
          height: 56,
          background: '#0F1F3D',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0px 8px 24px rgba(15,31,61,0.3)',
        }}
        aria-label="Add event"
      >
        <Plus className="h-6 w-6 text-white" />
      </button>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddEvent(false); }}
        >
          <div
            className="w-full max-w-[480px] overflow-y-auto"
            style={{
              background: 'white',
              borderRadius: '20px 20px 0 0',
              padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
              maxHeight: '92vh',
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-[20px] font-bold"
                style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
              >
                Add Event
              </h2>
              <button
                onClick={() => setShowAddEvent(false)}
                className="w-11 h-11 flex items-center justify-center rounded-[10px]"
                style={{ background: '#F3F4F6', border: 'none', cursor: 'pointer', color: '#8892A4' }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Event Title */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>
                Event Title *
              </label>
              <input
                value={evTitle}
                onChange={e => setEvTitle(e.target.value)}
                placeholder="E.g. Community BBQ"
                style={inputStyle}
              />
            </div>

            {/* Event Type */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-2" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>
                Event Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEvType(key)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] active:scale-95 transition-transform"
                    style={{
                      border: `1.5px solid ${evType === key ? cfg.color : '#E5E7EB'}`,
                      background: evType === key ? `${cfg.color}10` : 'white',
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                    <span
                      className="text-[12px] font-bold text-left"
                      style={{ color: evType === key ? cfg.color : '#4B5563', fontFamily: 'Inter, sans-serif' }}
                    >
                      {cfg.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>
                Date *
              </label>
              <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} style={inputStyle} />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>Start *</label>
                <input type="time" value={evStartTime} onChange={e => setEvStartTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>End</label>
                <input type="time" value={evEndTime} onChange={e => setEvEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Location */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>Location</label>
              <input value={evLocation} onChange={e => setEvLocation(e.target.value)} placeholder="E.g. Community Center" style={inputStyle} />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>Description</label>
              <textarea
                value={evDescription}
                onChange={e => setEvDescription(e.target.value)}
                placeholder="Optional details..."
                rows={3}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>

            {/* Community */}
            {communities.length > 1 && (
              <div className="mb-4">
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>Community</label>
                <select
                  value={evCommunityId}
                  onChange={e => setEvCommunityId(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                >
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Toggles */}
            <div className="flex flex-col gap-3 mb-6">
              {[
                { label: 'Enable RSVP', checked: evRsvp, onChange: setEvRsvp },
                { label: 'Notify Residents', checked: evNotify, onChange: setEvNotify },
              ].map(({ label, checked, onChange }) => (
                <div key={label} className="flex items-center justify-between py-2.5 px-4 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid rgba(15,31,61,0.06)' }}>
                  <span style={{ fontSize: 14, color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>{label}</span>
                  <div
                    onClick={() => onChange(!checked)}
                    className="cursor-pointer"
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 99,
                      background: checked ? '#00D4FF' : '#E5E7EB',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: checked ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        transition: 'left 0.2s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setShowAddEvent(false)}
              className="w-full py-3 rounded-[12px] mb-3"
              style={{
                background: 'white',
                border: '1px solid #0F1F3D',
                color: '#0F1F3D',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              Cancel
            </button>

            {/* Add Event */}
            <button
              type="button"
              onClick={!creating ? handleCreateEvent : undefined}
              className={`w-full py-3 rounded-[12px] text-white font-bold active:scale-[0.97] transition-transform ${creating ? 'opacity-50' : ''}`}
              style={{
                background: '#0F1F3D',
                fontSize: 16,
                fontFamily: 'Manrope, sans-serif',
                border: 'none',
                cursor: creating ? 'not-allowed' : 'pointer',
                minHeight: 52,
              }}
            >
              {creating ? 'Adding Event…' : 'Add Event'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMCalendar;
