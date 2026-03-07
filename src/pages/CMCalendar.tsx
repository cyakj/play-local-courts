import React, { useState } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { MOCK_EVENTS, MOCK_COMMUNITIES, EVENT_TYPE_CONFIG } from '@/components/condo-manager/mockData';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATES = [2, 3, 4, 5, 6, 7, 8];
const HAS_EVENTS = [3, 5, 7, 8];

const TYPE_MAP: Record<string, string> = {
  'Community Events': 'community_event',
  'Board Meetings': 'board_meeting',
  'Amenity Bookings': 'amenity_booking',
  Maintenance: 'maintenance_scheduled',
};

const CMCalendar = () => {
  const [communityFilter, setCommunityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedDay, setSelectedDay] = useState(7);

  const communityOptions = ['All', ...MOCK_COMMUNITIES.map((c) => c.name)];
  const filtered = MOCK_EVENTS.filter(
    (e) =>
      (communityFilter === 'All' || e.community === communityFilter) &&
      (typeFilter === 'All' || e.type === TYPE_MAP[typeFilter])
  );

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

      {/* Week strip */}
      <div className="bg-white border-b border-cm-border px-4 py-3 flex-shrink-0">
        <div className="flex justify-between">
          {DAYS.map((d, i) => {
            const dt = DATES[i];
            const isSel = dt === selectedDay;
            const hasE = HAS_EVENTS.includes(dt);
            return (
              <div
                key={d}
                onClick={() => setSelectedDay(dt)}
                className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="text-[10px] font-bold" style={{ color: isSel ? 'hsl(var(--cm-cyan))' : 'hsl(var(--cm-text-light))' }}>
                  {d}
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: isSel ? 'hsl(var(--cm-navy))' : 'transparent',
                    border: isSel ? '2px solid hsl(var(--cm-cyan))' : '2px solid transparent',
                  }}
                >
                  <span className="text-[13px] font-extrabold" style={{ color: isSel ? '#fff' : 'hsl(var(--cm-text))' }}>
                    {dt}
                  </span>
                </div>
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: hasE ? (isSel ? 'hsl(var(--cm-cyan))' : 'hsl(var(--cm-text-light))') : 'transparent' }}
                />
              </div>
            );
          })}
        </div>
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

        {filtered.length === 0 && (
          <div className="text-center py-8 text-cm-text-light">No events on this day</div>
        )}

        {filtered.map((e) => {
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
        <div className="text-xs font-bold text-cm-text-light mt-4 mb-2.5 tracking-wider uppercase">
          Upcoming This Month
        </div>
        {MOCK_EVENTS.map((e) => {
          const cfg = EVENT_TYPE_CONFIG[e.type] || { color: '#ccc', label: '' };
          return (
            <div key={e.id} className="bg-white rounded-xl p-2.5 mb-2 border border-cm-border flex gap-2.5">
              <div className="w-1 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
              <div>
                <div className="text-xs font-bold text-cm-text">{e.title}</div>
                <div className="text-[11px] text-cm-text-light mt-0.5">
                  {e.date} · {e.time} · {e.community}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CMCalendar;
