import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: '#00B4D8', label: 'Community Event' },
  board_meeting: { color: '#0A1628', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F59E0B', label: 'Maintenance' },
  amenity_booking: { color: '#2DD4BF', label: 'Amenity Booking' },
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ResidentEvent {
  id: string;
  title: string;
  event_type: string;
  location: string;
  starts_at: string;
  rsvp_enabled: boolean;
  rsvp_count: number;
  user_response: string | null;
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

const ResidentCalendar = () => {
  const now = new Date();
  const { currentUser, isAdmin } = useAuth();
  const { activeHOA } = useActiveHOA();
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [events, setEvents] = useState<ResidentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Create event form
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState('community_event');
  const [evDate, setEvDate] = useState('');
  const [evStartTime, setEvStartTime] = useState('');
  const [evEndTime, setEvEndTime] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evRsvp, setEvRsvp] = useState(false);
  const [evNotify, setEvNotify] = useState(true);

  const monthGrid = useMemo(() => buildMonthGrid(now.getFullYear(), now.getMonth()), []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!activeHOA?.hoaId) { setLoading(false); return; }

      const { data } = await supabase
        .from('hoa_events')
        .select('id, title, event_type, location, starts_at, rsvp_enabled')
        .eq('hoa_id', activeHOA.hoaId)
        .eq('status', 'active')
        .order('starts_at');

      if (!data) { setLoading(false); return; }

      // Get RSVP counts and user responses
      const eventIds = data.map(e => e.id);
      let rsvpMap = new Map<string, number>();
      let userResponses = new Map<string, string>();

      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('hoa_event_rsvps')
          .select('event_id, response, user_id')
          .in('event_id', eventIds);

        if (rsvps) {
          for (const r of rsvps) {
            if (r.response === 'going') {
              rsvpMap.set(r.event_id, (rsvpMap.get(r.event_id) || 0) + 1);
            }
            if (r.user_id === currentUser?.id) {
              userResponses.set(r.event_id, r.response);
            }
          }
        }
      }

      setEvents(data.map(e => ({
        ...e,
        rsvp_count: rsvpMap.get(e.id) || 0,
        user_response: userResponses.get(e.id) || null,
      })));
      setLoading(false);
    };
    fetchEvents();
  }, [activeHOA?.hoaId, currentUser?.id]);

  const handleRSVP = async (eventId: string, response: 'going' | 'not_going') => {
    if (!currentUser?.id) return;

    const { error } = await supabase
      .from('hoa_event_rsvps')
      .upsert({
        event_id: eventId,
        user_id: currentUser.id,
        response,
      }, { onConflict: 'event_id,user_id' });

    if (error) {
      toast.error('Failed to RSVP');
      return;
    }

    setEvents(prev => prev.map(e => {
      if (e.id !== eventId) return e;
      const wasGoing = e.user_response === 'going';
      const nowGoing = response === 'going';
      return {
        ...e,
        user_response: response,
        rsvp_count: e.rsvp_count + (nowGoing ? 1 : 0) - (wasGoing ? 1 : 0),
      };
    }));
    toast.success(response === 'going' ? 'You\'re going!' : 'RSVP updated');
  };

  const handleCreateEvent = async () => {
    if (!evTitle.trim() || !evDate || !evStartTime || !activeHOA?.hoaId || !currentUser?.id) return;

    const startsAt = new Date(`${evDate}T${evStartTime}`).toISOString();
    const endsAt = evEndTime ? new Date(`${evDate}T${evEndTime}`).toISOString() : null;

    const { error } = await supabase.from('hoa_events').insert({
      hoa_id: activeHOA.hoaId,
      created_by: currentUser.id,
      title: evTitle.trim(),
      description: evDescription.trim() || null,
      event_type: evType,
      location: evLocation.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      rsvp_enabled: evRsvp,
    });

    if (error) { toast.error('Failed to create event'); return; }

    // Notify residents
    if (evNotify) {
      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .eq('hoa_id', activeHOA.hoaId)
        .eq('status', 'approved');

      if (members) {
        await supabase.from('hoa_notifications').insert(
          members.map(m => ({
            user_id: m.user_id,
            hoa_id: activeHOA.hoaId,
            type: 'event_created' as const,
            title: `New event: ${evTitle.trim()}`,
            body: `${evDate} at ${evStartTime}${evLocation ? ` · ${evLocation}` : ''}`,
          }))
        );
      }
    }

    toast.success('Event created');
    setShowCreateEvent(false);
    // Refresh
    window.location.reload();
  };

  const getDotsForDay = (day: number) => {
    const dayEvts = events.filter(e => new Date(e.starts_at).getDate() === day);
    return [...new Set(dayEvts.map(e => EVENT_TYPE_CONFIG[e.event_type]?.color).filter(Boolean))].slice(0, 3);
  };

  const dayEvents = events.filter(e => new Date(e.starts_at).getDate() === selectedDay);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="navy-gradient text-white px-5 pt-[50px] pb-5">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xl font-extrabold">Calendar</div>
            <div className="text-xs opacity-65 mt-0.5">{now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreateEvent(true)} className="rounded-[10px] px-3.5 py-2 text-xs font-bold min-h-[44px]" style={{ background: '#00B4D8' }}>
              ＋ Add Event
            </button>
          )}
        </div>
      </div>

      {/* Month grid */}
      <div className="bg-card mx-4 rounded-2xl p-4 border border-border mb-4">
        <div className="grid grid-cols-7 mb-1">
          {WEEK_DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-muted-foreground">{d}</div>
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
                    color: !cell.inMonth ? '#E5E7EB' : isSel ? '#fff' : 'hsl(var(--foreground))',
                  }}>{cell.day}</span>
                  {isToday && !isSel && <div className="absolute -bottom-0.5 w-3 h-[2px] rounded-full bg-primary" />}
                </div>
                <div className="flex gap-0.5 mt-0.5 h-1.5">
                  {dots.map((c, j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 flex gap-3 mb-4">
        {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
            <span className="text-[9px] text-muted-foreground">{v.label}</span>
          </div>
        ))}
      </div>

      {/* Day events */}
      <div className="px-4">
        <div className="text-xs font-bold text-muted-foreground mb-2.5 tracking-wider uppercase">
          {now.toLocaleString('en-US', { month: 'short' })} {selectedDay} Events
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : dayEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No events on this day</div>
        ) : (
          dayEvents.map(e => {
            const cfg = EVENT_TYPE_CONFIG[e.event_type] || { color: '#ccc', label: '' };
            const dt = new Date(e.starts_at);
            return (
              <div key={e.id} className="bg-card rounded-2xl p-4 mb-3 border border-border flex gap-3">
                <div className="w-1 rounded-full flex-shrink-0 min-h-[50px]" style={{ background: cfg.color }} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">{e.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    {e.location && ` · ${e.location}`}
                  </div>
                  {e.rsvp_enabled && (
                    <div className="mt-2">
                      <div className="text-[11px] text-muted-foreground mb-1.5">{e.rsvp_count} people going</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRSVP(e.id, 'going')}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold min-h-[44px] ${e.user_response === 'going' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                        >
                          Going
                        </button>
                        <button
                          onClick={() => handleRSVP(e.id, 'not_going')}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold min-h-[44px] ${e.user_response === 'not_going' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}
                        >
                          Not Going
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4 px-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-5">
            <div className="text-lg font-bold text-foreground mb-4">Create Event</div>
            <input value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Event title" className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3" />
            <select value={evType} onChange={e => setEvType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3">
              <option value="community_event">Community Event</option>
              <option value="board_meeting">Board Meeting</option>
              <option value="maintenance_scheduled">Maintenance Scheduled</option>
              <option value="amenity_booking">Amenity Booking</option>
            </select>
            <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3" />
            <div className="flex gap-2 mb-3">
              <input type="time" value={evStartTime} onChange={e => setEvStartTime(e.target.value)} placeholder="Start" className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm" />
              <input type="time" value={evEndTime} onChange={e => setEvEndTime(e.target.value)} placeholder="End" className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm" />
            </div>
            <input value={evLocation} onChange={e => setEvLocation(e.target.value)} placeholder="Location" className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3" />
            <textarea value={evDescription} onChange={e => setEvDescription(e.target.value)} placeholder="Description" rows={2} className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3 resize-none" />
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={evRsvp} onChange={e => setEvRsvp(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">Enable RSVP</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={evNotify} onChange={e => setEvNotify(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">Notify residents</span>
            </div>
            <button onClick={handleCreateEvent} className="bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold w-full min-h-[44px]">
              Create Event
            </button>
            <div onClick={() => setShowCreateEvent(false)} className="text-center mt-3 text-sm text-muted-foreground cursor-pointer">
              Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentCalendar;
