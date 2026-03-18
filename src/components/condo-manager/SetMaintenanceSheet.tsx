import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, isToday } from 'date-fns';
import BookingDetailSheet from './BookingDetailSheet';

const isSlotInPast = (slotTime: string, date: Date): boolean => {
  if (!isToday(date)) return false;
  const now = new Date();
  const slotEndHour = parseInt(slotTime.split(':')[0], 10) + 1;
  return now.getHours() >= slotEndHour;
};

interface SetMaintenanceSheetProps {
  open: boolean;
  onClose: () => void;
  amenity: { id: string; name: string; type: string; hoaId: string };
}

type SlotType = 'available' | 'booked' | 'maintenance';

interface SlotState {
  time: string;
  endTime: string;
  displayStart: string;
  displayEnd: string;
  state: SlotType;
  // Booking info (when booked)
  bookingId?: string;
  unitNumber?: string;
  playType?: string;
  userId?: string;
}

const formatHour = (h: number): string => {
  const display = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${display}:00 ${suffix}`;
};

const generateTimeSlots = (startHour = 6, endHour = 22): SlotState[] => {
  const slots: SlotState[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push({
      time: `${String(h).padStart(2, '0')}:00`,
      endTime: `${String(h + 1).padStart(2, '0')}:00`,
      displayStart: formatHour(h),
      displayEnd: formatHour(h + 1),
      state: 'available',
    });
  }
  return slots;
};

const SetMaintenanceSheet: React.FC<SetMaintenanceSheetProps> = ({ open, onClose, amenity }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<SlotState[]>(generateTimeSlots());
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SlotState | null>(null);
  const dateStripRef = useRef<HTMLDivElement>(null);

  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  // Fetch existing maintenance + bookings for the selected date
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Fetch maintenance and bookings in parallel
      const [maintResult, bookingsResult] = await Promise.all([
        supabase
          .from('court_maintenance')
          .select('start_time, end_time')
          .eq('court_id', amenity.id)
          .eq('date', dateStr),
        supabase
          .from('bookings')
          .select('id, start_time, end_time, play_type, user_id')
          .eq('court_id', amenity.id)
          .eq('date', dateStr)
          .eq('status', 'confirmed'),
      ]);

      // Fetch unit numbers for booked users
      let unitMap: Record<string, string> = {};
      if (bookingsResult.data && bookingsResult.data.length > 0) {
        const userIds = [...new Set(bookingsResult.data.map(b => b.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, unit_number')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach(p => {
            unitMap[p.id] = p.unit_number || 'Unknown';
          });
        }
      }

      const fresh = generateTimeSlots();
      
      // Mark maintenance slots
      if (maintResult.data) {
        maintResult.data.forEach((m) => {
          const startH = parseInt(m.start_time.split(':')[0], 10);
          const idx = fresh.findIndex((s) => parseInt(s.time.split(':')[0], 10) === startH);
          if (idx >= 0) fresh[idx].state = 'maintenance';
        });
      }

      // Mark booked slots
      if (bookingsResult.data) {
        bookingsResult.data.forEach((b) => {
          const startH = parseInt(b.start_time.split(':')[0], 10);
          const endH = parseInt(b.end_time.split(':')[0], 10);
          for (let h = startH; h < endH; h++) {
            const idx = fresh.findIndex((s) => parseInt(s.time.split(':')[0], 10) === h);
            if (idx >= 0) {
              fresh[idx].state = 'booked';
              fresh[idx].bookingId = b.id;
              fresh[idx].unitNumber = unitMap[b.user_id] || 'Unknown';
              fresh[idx].playType = b.play_type || 'Singles';
              fresh[idx].userId = b.user_id;
            }
          }
        });
      }

      setSlots(fresh);
    };
    fetchData();
  }, [open, selectedDate, amenity.id]);

  const handleSlotTap = (idx: number) => {
    const slot = slots[idx];
    if (isSlotInPast(slot.time, selectedDate)) return;
    
    if (slot.state === 'booked') {
      setSelectedBooking(slot);
      return;
    }
    
    // Toggle available <-> maintenance
    setSlots((prev) => prev.map((s, i) => 
      i === idx ? { ...s, state: s.state === 'maintenance' ? 'available' : 'maintenance' } : s
    ));
  };

  const handleCancelBooking = async (slot: SlotState) => {
    if (!slot.bookingId) return;
    
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', slot.bookingId);
    
    if (error) {
      toast.error('Failed to cancel booking');
      return;
    }

    // Send notification to resident
    if (slot.userId) {
      await supabase.from('hoa_notifications').insert({
        user_id: slot.userId,
        hoa_id: amenity.hoaId,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        body: `Your booking for ${amenity.name} on ${format(selectedDate, 'MMM d')} at ${slot.displayStart} has been cancelled by the admin.`,
      });
    }

    // Revert slot to available
    setSlots((prev) => prev.map(s => 
      s.time === slot.time ? { ...s, state: 'available', bookingId: undefined, unitNumber: undefined, playType: undefined, userId: undefined } : s
    ));
    setSelectedBooking(null);
    toast.success('Booking cancelled');
  };

  const handleSave = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Delete existing maintenance for this amenity+date
    await supabase.from('court_maintenance').delete().eq('court_id', amenity.id).eq('date', dateStr);

    // Insert new maintenance slots
    const maintenanceSlots = slots.filter((s) => s.state === 'maintenance');
    if (maintenanceSlots.length > 0) {
      const rows = maintenanceSlots.map((s) => ({
        court_id: amenity.id,
        date: dateStr,
        start_time: s.time,
        end_time: s.endTime,
        description: 'Scheduled maintenance',
      }));
      const { error } = await supabase.from('court_maintenance').insert(rows);
      if (error) {
        toast.error('Failed to save maintenance schedule');
        setLoading(false);
        return;
      }
    }

    toast.success('Maintenance schedule saved');
    setLoading(false);
    onClose();
  };

  if (!open) return null;

  const availableCount = slots.filter(s => s.state === 'available').length;
  const bookedCount = slots.filter(s => s.state === 'booked').length;
  const maintenanceCount = slots.filter(s => s.state === 'maintenance').length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl" style={{ height: '75vh' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#E5E7EB' }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 pb-3">
          <div>
            <div className="text-lg font-extrabold" style={{ color: '#1A1A2E' }}>Set Maintenance</div>
            <div className="text-[13px] font-semibold" style={{ color: '#00B4D8' }}>{amenity.name}</div>
          </div>
          <div
            onClick={onClose}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 44, height: 44 }}
          >
            <X className="h-5 w-5" style={{ color: '#9CA3AF' }} />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-24" style={{ height: 'calc(75vh - 140px)' }}>
          {/* Date strip */}
          <div
            ref={dateStripRef}
            className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {dates.map((d) => {
              const active = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              return (
                <div
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className="flex flex-col items-center px-3 py-2 cursor-pointer flex-shrink-0"
                  style={{
                    backgroundColor: active ? '#0A1628' : '#F0F4F8',
                    color: active ? '#FFFFFF' : '#4B5563',
                    borderRadius: 10,
                    minWidth: 52,
                  }}
                >
                  <span className="text-[10px] font-bold">
                    {isToday(d) ? 'Today' : format(d, 'EEE')}
                  </span>
                  <span className="text-base font-extrabold">{format(d, 'd')}</span>
                </div>
              );
            })}
          </div>

          {/* Legend bar */}
          <div className="flex items-center gap-4 py-2.5 mb-2" style={{ borderBottom: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#E6FFFA', border: '1.5px solid #2DD4BF' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{availableCount} Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#DBEAFE', border: '1.5px solid #2563EB' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{bookedCount} Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#FEF2F2', border: '1.5px solid #EF4444' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{maintenanceCount} Maint.</span>
            </div>
          </div>

          {/* Hint text */}
          <div className="text-[11px] italic mb-2.5" style={{ color: '#9CA3AF' }}>
            Tap available/maintenance to toggle · Tap booked to manage
          </div>

          {/* Time slot grid */}
          <div className="grid grid-cols-2 gap-2">
            {slots.map((slot, idx) => {
              const past = isSlotInPast(slot.time, selectedDate);
              const { state } = slot;

              const stateStyles = {
                available: { bg: '#F0F4F8', border: '1.5px solid #E5E7EB', badgeBg: '#E6FFFA', badgeColor: '#2DD4BF' },
                booked: { bg: '#EFF6FF', border: '1.5px solid #93C5FD', badgeBg: '#DBEAFE', badgeColor: '#2563EB' },
                maintenance: { bg: '#FEF2F2', border: '1.5px solid #EF4444', badgeBg: '#FEF2F2', badgeColor: '#EF4444' },
              };
              const cfg = stateStyles[state];

              return (
                <div
                  key={slot.time}
                  onClick={() => !past && handleSlotTap(idx)}
                  style={{
                    backgroundColor: past ? '#F3F4F6' : cfg.bg,
                    border: past ? '1.5px solid #E5E7EB' : cfg.border,
                    borderRadius: 12,
                    padding: '7px 8px 6px',
                    opacity: past ? 0.5 : 1,
                    cursor: past ? 'not-allowed' : 'pointer',
                  }}
                >
                  {/* Start time */}
                  <div className="text-xs font-extrabold leading-tight" style={{ color: past ? '#9CA3AF' : '#1A1A2E' }}>
                    {slot.displayStart}
                  </div>
                  {/* End time */}
                  <div className="text-[9px] mt-0.5 mb-1.5" style={{ color: '#9CA3AF' }}>
                    → {slot.displayEnd}
                  </div>

                  {past ? (
                    <span className="text-[9px] font-bold" style={{ color: '#9CA3AF' }}>Passed</span>
                  ) : (
                    <>
                      {/* State badge */}
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold"
                        style={{
                          backgroundColor: cfg.badgeBg,
                          color: cfg.badgeColor,
                          padding: '2px 7px',
                          borderRadius: 99,
                        }}
                      >
                        <span>{state === 'available' ? '✓' : state === 'booked' ? '🏠' : '🔧'}</span>
                        <span>{state === 'available' ? 'Available' : state === 'booked' ? (slot.unitNumber || 'Booked') : 'Maint.'}</span>
                      </span>

                      {/* Sub-info */}
                      {state === 'booked' && (
                        <div className="text-[9px] mt-1" style={{ color: '#9CA3AF' }}>
                          {(slot.playType || 'Singles').charAt(0).toUpperCase() + (slot.playType || 'singles').slice(1)} · 1 hr
                        </div>
                      )}
                      {state === 'available' && (
                        <div className="text-[9px] mt-1" style={{ color: '#9CA3AF' }}>Tap to block</div>
                      )}
                      {state === 'maintenance' && (
                        <div className="text-[9px] mt-1" style={{ color: '#9CA3AF' }}>Tap to free</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t" style={{ borderColor: '#E5E7EB' }}>
          <div
            onClick={loading ? undefined : handleSave}
            className="text-center cursor-pointer text-sm font-bold flex items-center justify-center"
            style={{
              backgroundColor: '#0A1628',
              color: '#FFFFFF',
              borderRadius: 10,
              padding: 14,
              width: '100%',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save Maintenance Schedule'}
          </div>
        </div>
      </div>

      {/* Booking detail sheet */}
      {selectedBooking && (
        <BookingDetailSheet
          slot={selectedBooking}
          amenityName={amenity.name}
          selectedDate={selectedDate}
          onClose={() => setSelectedBooking(null)}
          onCancel={handleCancelBooking}
        />
      )}
    </>
  );
};

export default SetMaintenanceSheet;
