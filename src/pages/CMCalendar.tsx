import React, { useState, useMemo } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { MOCK_EVENTS, MOCK_COMMUNITIES, EVENT_TYPE_CONFIG } from '@/components/condo-manager/mockData';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_DATES = [2, 3, 4, 5, 6, 7, 8];
const TODAY = 7; // March 7, 2026

const TYPE_MAP: Record<string, string> = {
  'Community Events': 'community_event',
  'Board Meetings': 'board_meeting',
  'Amenity Bookings': 'amenity_booking',
  Maintenance: 'maintenance_scheduled',
};

// Build March 2026 grid (starts on Sunday)
const buildMonthGrid = () => {
  // March 2026: 31 days, March 1 is a Sunday
  // Week starts Monday, so we need Feb 23-28 as leading days
  const firstDayOfWeek = 6; // Sunday = 6 in Mon-start (0=Mon..6=Sun)
  const daysInMonth = 31;
  const grid: { day: number; inMonth: boolean }[] = [];

  // Leading days from previous month (Feb 2026 has 28 days)
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    grid.push({ day: 28 - i, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({ day: d, inMonth: true });
  }
  // Trailing days
  const remaining = 7 - (grid.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      grid.push({ day: d, inMonth: false });
    }
  }
  return grid;
};

const MONTH_GRID = buildMonthGrid();

const CMCalendar = () => {
  const [communityFilter, setCommunityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week');

  const communityOptions = ['All', ...MOCK_COMMUNITIES.map((c) => c.name)];

  const filtered = MOCK_EVENTS.filter(
    (e) =>
      (communityFilter === 'All' || e.community === communityFilter) &&
      (typeFilter === 'All' || e.type === TYPE_MAP[typeFilter])
  );

  const dayEvents = filtered.filter((e) => e.day === selectedDay);

  const upcomingEvents = useMemo(() => {
    return filtered
      .filter((e) => e.day > selectedDay)
      .sort((a, b) => a.day - b.day);
  }, [filtered, selectedDay]);

  // Get event type colors for a specific day
  const getDotsForDay = (day: number) => {
    const dayEvts = MOCK_EVENTS.filter((e) => e.day === day);
    const colors = [...new Set(dayEvts.map((e) => EVENT_TYPE_CONFIG[e.type]?.color).filter(Boolean))];
    return colors.slice(0, 3);
  };

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex justify-between items-start mb-3.5">
          <div>
            <div className="text-xl font-extrabold">Calendar</div>
            <div className="text-xs opacity-65">March 2026</div>
          </div>
          <div className="bg-[rgba(0,180,216,0.2)] border border-[rgba(0,180,216,0.5)] rounded-[10px] px-3.5 py-2 text-xs font-bold text-white cursor-pointer min-h-[44px] flex items-center">
            ＋ Add Event
          </div>
        </div>
        <CMChips options={communityOptions} value={communityFilter} onChange={setCommunityFilter} />
      </CMHeader>

      {/* Calendar card with week/month toggle */}
      <div className="bg-white border-b border-cm-border px-4 py-3 flex-shrink-0">
        {/* Toggle buttons */}
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
          /* Week strip */
          <div className="flex justify-between">
            {WEEK_DAYS.map((d, i) => {
              const dt = WEEK_DATES[i];
              const isSel = dt === selectedDay;
              const dots = getDotsForDay(dt);
              return (
                <div
                  key={d}
                  onClick={() => setSelectedDay(dt)}
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                >
                  <div className="text-[10px] font-bold" style={{ color: isSel ? '#00B4D8' : '#9CA3AF' }}>
                    {d}
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: isSel ? '#0A1628' : 'transparent',
                      border: isSel ? '2px solid #00B4D8' : '2px solid transparent',
                    }}
                  >
                    <span className="text-[13px] font-extrabold" style={{ color: isSel ? '#fff' : '#1A1A2E' }}>
                      {dt}
                    </span>
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
          /* Month grid */
          <div>
            {/* Column headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map((d) => (
                <div key={d} className="text-center text-[11px] font-bold" style={{ color: '#9CA3AF' }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Date grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {MONTH_GRID.map((cell, idx) => {
                const isSel = cell.inMonth && cell.day === selectedDay;
                const isToday = cell.inMonth && cell.day === TODAY;
                const dots = cell.inMonth ? getDotsForDay(cell.day) : [];

                return (
                  <div
                    key={idx}
                    onClick={() => cell.inMonth && setSelectedDay(cell.day)}
                    className="flex flex-col items-center cursor-pointer py-0.5"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center relative"
                      style={{
                        background: isSel ? '#0A1628' : 'transparent',
                        border: isSel ? '2px solid #00B4D8' : '2px solid transparent',
                      }}
                    >
                      <span
                        className="text-[13px] font-extrabold"
                        style={{
                          color: !cell.inMonth ? '#E5E7EB' : isSel ? '#fff' : '#1A1A2E',
                        }}
                      >
                        {cell.day}
                      </span>
                      {/* Today indicator (non-selected) */}
                      {isToday && !isSel && (
                        <div className="absolute -bottom-0.5 w-3 h-[2px] rounded-full" style={{ background: '#00B4D8' }} />
                      )}
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((c, j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Type filter chips */}
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
        <div className="text-xs font-bold text-cm-text-light mb-2.5 tracking-wider uppercase">
          Mar {selectedDay} Events
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
                  <div
                    className="rounded-lg px-3 py-1 text-[11px] font-bold cursor-pointer min-h-[44px] flex items-center"
                    style={{ background: `${cfg.color}18`, color: cfg.color }}
                  >
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

        {/* Upcoming this month */}
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
      </div>
    </div>
  );
};

export default CMCalendar;
