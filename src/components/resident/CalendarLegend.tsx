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
      <div key={item.label} className="flex items-center gap-1">
        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
        <span className="text-[9px] text-muted-foreground">{item.label}</span>
      </div>
    ))}
  </div>
);

export default CalendarLegend;
