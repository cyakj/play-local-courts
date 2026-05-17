import React from 'react';

const LEGEND_ITEMS = [
  { color: '#00D4FF', label: 'Community Event' },
  { color: '#0F1F3D', label: 'Board Meeting' },
  { color: '#F59E0B', label: 'Maintenance' },
  { color: '#00D4FF', label: 'Amenity Booking' },
];

const CalendarLegend = () => (
  <div className="flex gap-3 flex-wrap">
    {LEGEND_ITEMS.map(item => (
      <div key={item.label} className="flex items-center gap-1.5">
        <div className="rounded-full flex-shrink-0" style={{ background: item.color, width: 10, height: 10 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{item.label}</span>
      </div>
    ))}
  </div>
);

export default CalendarLegend;
