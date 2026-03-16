import React from 'react';
import { X, MapPin, Clock, Calendar, Tag } from 'lucide-react';

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: '#00B4D8', label: 'Community Event' },
  board_meeting: { color: '#0A1628', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F59E0B', label: 'Maintenance' },
  amenity_booking: { color: '#2DD4BF', label: 'Amenity Booking' },
};

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  location: string | null;
  starts_at: string;
  description?: string | null;
  community_name?: string;
}

interface CalendarEventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
}

const CalendarEventDetail = ({ event, onClose }: CalendarEventDetailProps) => {
  const cfg = EVENT_TYPE_CONFIG[event.event_type] || { color: '#ccc', label: '' };
  const dt = new Date(event.starts_at);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card w-full max-w-md rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div
              className="inline-flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2.5 py-1 mb-2"
              style={{ background: `${cfg.color}20`, color: cfg.color }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
              {cfg.label}
            </div>
            <div className="text-lg font-extrabold text-foreground">{event.title}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {event.community_name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Tag className="w-3.5 h-3.5" />
            {event.community_name}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Calendar className="w-3.5 h-3.5" />
          {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5" />
          {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>

        {event.location && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <MapPin className="w-3.5 h-3.5" />
            {event.location}
          </div>
        )}

        {event.description && (
          <div className="mt-3 p-3 bg-muted rounded-xl text-xs text-foreground leading-relaxed">
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarEventDetail;
