import React from 'react';

const EVENT_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'community_event', label: 'Community Events' },
  { value: 'board_meeting', label: 'Board Meetings' },
  { value: 'amenity_booking', label: 'Amenity Bookings' },
  { value: 'maintenance_scheduled', label: 'Maintenance' },
];

interface CalendarEventTypeChipsProps {
  activeType: string;
  onSelect: (val: string) => void;
}

const CalendarEventTypeChips = ({ activeType, onSelect }: CalendarEventTypeChipsProps) => (
  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
    {EVENT_TYPES.map(t => {
      const isActive = activeType === t.value;
      return (
        <button
          key={t.value}
          onClick={() => onSelect(t.value)}
          className="whitespace-nowrap flex-shrink-0 text-xs font-bold rounded-full px-4 py-[7px] transition-colors"
          style={{
            background: isActive ? 'hsl(var(--navy))' : 'hsl(var(--card))',
            color: isActive ? '#fff' : 'hsl(var(--muted-foreground))',
            border: isActive ? '1px solid hsl(var(--navy))' : '1px solid hsl(var(--border))',
          }}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);

export default CalendarEventTypeChips;
