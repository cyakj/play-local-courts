import React, { useState, useEffect, useMemo } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: '#00D4FF', label: 'Community Event' },
  board_meeting: { color: '#0F1F3D', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F97066', label: 'Maintenance' },
  amenity_booking: { color: '#8892A4', label: 'Amenity Booking' },
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
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
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
  const { currentUser } = useAuth();
  const [communityFilter, setCommunityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week');
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
  const monthGrid = useMemo(() => buildMonthGrid(now.getFullYear(), now.getMonth()), []);

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
        date: `${dt.toLocaleString('en-US', { month: 'short' })} ${dt.getDate()}`,
        day: dt.getDate(),
        time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        location: e.location || '',
        rsvp: e.rsvp_enabled ? (rsvpCounts.get(e.id) || 0) : null,
      };
    });

    setEvents(calEvents);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [communities]);

  // Set default community for event creation
  useEffect(() => {
    if (communities.length > 0 && !evCommunityId) {
      setEvCommunityId(communities[0].id);
    }
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

    if (error) {
      toast.error('Failed to create event');
      setCreating(false);
      return;
    }

    // Notify residents
    if (evNotify) {
      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .eq('hoa_id', evCommunityId)
        .eq('status', 'approved');

      if (members) {
        await supabase.from('hoa_notifications').insert(
          members.map(m => ({
            user_id: m.user_id,
            hoa_id: evCommunityId,
            type: 'event_created' as const,
            title: `New event: ${evTitle.trim()}`,
            body: `${evDate} at ${evStartTime}${evLocation ? ` · ${evLocation}` : ''}`,
          }))
        );
      }
    }

    toast.success('Event added');
    setShowAddEvent(false);
    setEvTitle('');
    setEvDate('');
    setEvStartTime('');
    setEvEndTime('');
    setEvLocation('');
    setEvDescription('');
    setEvRsvp(false);
    setEvNotify(true);
    setCreating(false);
    fetchEvents();
  };

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

  const getWeekDates = () => {
    const today = now.getDate();
    const dayOfWeek = now.getDay();
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
          <div
            onClick={() => setShowAddEvent(true)}
            className="bg-[rgba(0,180,216,0.2)] border border-[rgba(0,180,216,0.5)] rounded-[10px] px-3.5 py-2 text-xs font-bold text-white cursor-pointer min-h-[44px] flex items-center"
          >
            ＋ Add Event
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 overflow-x-auto">
            <CMChips options={communityOptions} value={communityFilter} onChange={setCommunityFilter} />
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCalendarMode(mode)}
                className="rounded-lg px-3 py-2 text-[13px] font-bold capitalize transition-colors min-h-[40px]"
                style={{
                  background: calendarMode === mode ? 'rgba(0,180,216,0.35)' : 'rgba(255,255,255,0.1)',
                  color: calendarMode === mode ? '#fff' : 'rgba(255,255,255,0.6)',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </CMHeader>

      {/* Calendar card */}
      <div className="bg-white border-b border-cm-border px-4 py-3 flex-shrink-0">

        {calendarMode === 'week' ? (
          <div className="flex justify-between">
            {WEEK_DAYS.map((d, i) => {
              const dt = weekDates[i];
              const isSel = dt === selectedDay;
              const dots = getDotsForDay(dt);
              return (
                <div key={d} onClick={() => setSelectedDay(dt)} className="flex-1 flex flex-col items-center gap-1 cursor-pointer">
                  <div className="text-[10px] font-bold" style={{ color: isSel ? '#00D4FF' : '#9CA3AF' }}>{d}</div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                    background: isSel ? '#0F1F3D' : 'transparent',
                    border: isSel ? '2px solid #00D4FF' : '2px solid transparent',
                  }}>
                    <span className="text-[13px] font-extrabold" style={{ color: isSel ? '#fff' : '#0F1F3D' }}>{dt}</span>
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
                      background: isSel ? '#0F1F3D' : 'transparent',
                      border: isSel ? '2px solid #00D4FF' : '2px solid transparent',
                    }}>
                      <span className="text-[13px] font-extrabold" style={{
                        color: !cell.inMonth ? '#E5E7EB' : isSel ? '#fff' : '#0F1F3D',
                      }}>{cell.day}</span>
                      {isToday && !isSel && (
                        <div className="absolute -bottom-0.5 w-3 h-[2px] rounded-full" style={{ background: '#00D4FF' }} />
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
      <div className="bg-white px-4 py-2 border-b border-cm-border flex gap-3 flex-shrink-0 flex-wrap">
        {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
            <span className="text-[11px] text-cm-text-light">{v.label}</span>
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

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold text-cm-navy">Add Event</div>
              <button
                onClick={() => setShowAddEvent(false)}
                aria-label="Close"
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  color: '#8892A4',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <input
              value={evTitle}
              onChange={e => setEvTitle(e.target.value)}
              placeholder="Event title"
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            />

            {/* Event type with color swatches */}
            <div className="text-[13px] font-bold text-cm-text mb-2">Event Type</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                <div
                  key={key}
                  onClick={() => setEvType(key)}
                  className="flex items-center gap-2 px-3 py-2 rounded-[10px] border cursor-pointer min-h-[44px]"
                  style={{
                    borderColor: evType === key ? cfg.color : '#E5E7EB',
                    background: evType === key ? `${cfg.color}10` : '#fff',
                  }}
                >
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                  <span className="text-xs font-bold" style={{ color: evType === key ? cfg.color : '#4B5563' }}>{cfg.label}</span>
                </div>
              ))}
            </div>

            <input
              type="date"
              value={evDate}
              onChange={e => setEvDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            />
            <div className="flex gap-2 mb-3">
              <input type="time" value={evStartTime} onChange={e => setEvStartTime(e.target.value)} placeholder="Start" className="flex-1 px-3 py-2.5 rounded-[10px] border border-cm-border text-sm" />
              <input type="time" value={evEndTime} onChange={e => setEvEndTime(e.target.value)} placeholder="End" className="flex-1 px-3 py-2.5 rounded-[10px] border border-cm-border text-sm" />
            </div>
            <input
              value={evLocation}
              onChange={e => setEvLocation(e.target.value)}
              placeholder="Location"
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            />
            <textarea
              value={evDescription}
              onChange={e => setEvDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3 resize-none"
            />

            {/* Community selector */}
            <select
              value={evCommunityId}
              onChange={e => setEvCommunityId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            >
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={evRsvp} onChange={e => setEvRsvp(e.target.checked)} className="rounded" />
              <span className="text-sm text-cm-text">Enable RSVP</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={evNotify} onChange={e => setEvNotify(e.target.checked)} className="rounded" />
              <span className="text-sm text-cm-text">Notify Residents</span>
            </div>

            <div
              onClick={!creating ? handleCreateEvent : undefined}
              className={`bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full min-h-[44px] flex items-center justify-center ${creating ? 'opacity-50' : ''}`}
            >
              {creating ? 'Adding...' : 'Add Event'}
            </div>
            <div
              onClick={() => setShowAddEvent(false)}
              className="text-center mt-3 mb-20 cursor-pointer underline"
              style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500 }}
            >
              Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMCalendar;
