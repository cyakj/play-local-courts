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
  <div
    className="flex gap-2 overflow-x-auto scrollbar-hide"
    style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
  >
    {EVENT_TYPES.map(t => {
      const isActive = activeType === t.value;
      return (
        <button
          key={t.value}
          onClick={() => onSelect(t.value)}
          className="whitespace-nowrap flex-shrink-0 rounded-full px-4 py-[7px] transition-colors"
          style={{
            fontSize: 14,
            fontWeight: 600,
            background: isActive ? '#0F1F3D' : '#F9FAFB',
            color: isActive ? '#FFFFFF' : '#4B5563',
            border: isActive ? '1px solid #0F1F3D' : '1px solid #E5E7EB',
            scrollSnapAlign: 'start',
          }}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);

export default CalendarEventTypeChips;
