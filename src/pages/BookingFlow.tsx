import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useAmenityRules } from '../hooks/useAmenityRules';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isToday } from 'date-fns';
import { ArrowLeft, Check } from 'lucide-react';
import ResidentHeader from '@/components/resident/ResidentHeader';
import { AmenityStatus } from '../types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const amenityLabels: Record<string, string> = {
  tennis: 'Court', pickleball: 'Court', pool: 'Pool', barbecue: 'BBQ Area',
  clubhouse: 'Clubhouse', gym: 'Gym', jacuzzi: 'Spa',
};

interface BookedSlot {
  start_time: string;
  end_time: string;
  unit_number?: string;
}

interface MaintenanceSlot {
  start_time: string;
  end_time: string;
}

const BookingFlow: React.FC = () => {
  const { amenityId } = useParams<{ amenityId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { amenities, bookAmenity } = useData();
  const { rules, loading: rulesLoading } = useAmenityRules(amenityId || '');

  const amenity = amenities.find(a => a.id === amenityId);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [playType, setPlayType] = useState<'singles' | 'doubles'>('singles');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [maintenanceSlots, setMaintenanceSlots] = useState<MaintenanceSlot[]>([]);
  const [confirming, setConfirming] = useState(false);

  // Advance booking days
  const advanceDays = rules?.advance_booking_days ?? 7;

  // Date pills
  const datePills = useMemo(() => {
    const pills: Date[] = [];
    const today = new Date();
    for (let i = 0; i <= advanceDays; i++) {
      pills.push(addDays(today, i));
    }
    return pills;
  }, [advanceDays]);

  // Duration options
  const singlesMax = rules?.max_duration_minutes ?? 60;
  const doublesMax = rules?.max_duration_minutes ?? 90;
  const currentMax = playType === 'singles' ? singlesMax : doublesMax;

  const durationOptions = useMemo(() => {
    const opts: number[] = [];
    for (let d = 30; d <= currentMax; d += 30) opts.push(d);
    if (opts.length === 0) opts.push(30);
    return opts;
  }, [currentMax]);

  // Reset duration and slot when play type changes
  useEffect(() => {
    setSelectedDuration(null);
    setSelectedSlot(null);
  }, [playType]);

  // Reset slot when duration changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDuration]);

  // Fetch bookings + maintenance for selected date and amenity
  useEffect(() => {
    if (!amenityId) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const fetchSlots = async () => {
      const [bookingsRes, maintRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('start_time, end_time, user_id')
          .eq('court_id', amenityId)
          .eq('date', dateStr)
          .eq('status', 'confirmed'),
        supabase
          .from('court_maintenance')
          .select('start_time, end_time')
          .eq('court_id', amenityId)
          .eq('date', dateStr),
      ]);

      // For booked slots, fetch unit_number from profiles
      const bookings = bookingsRes.data || [];
      const userIds = [...new Set(bookings.map(b => b.user_id))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, unit_number')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach(p => {
            if (p.unit_number) profileMap[p.id] = p.unit_number;
          });
        }
      }

      setBookedSlots(bookings.map(b => ({
        start_time: b.start_time,
        end_time: b.end_time,
        unit_number: profileMap[b.user_id] || undefined,
      })));
      setMaintenanceSlots(maintRes.data || []);
    };

    fetchSlots();
    setSelectedSlot(null);
  }, [amenityId, selectedDate]);

  // Operating hours
  const startHour = rules?.booking_start_time ? parseInt(rules.booking_start_time.split(':')[0]) : 6;
  const endHour = rules?.booking_end_time ? parseInt(rules.booking_end_time.split(':')[0]) : 22;

  // Generate time slots
  const timeSlots = useMemo(() => {
    if (!selectedDuration) return [];
    const slots: string[] = [];
    const durationHours = selectedDuration / 60;
    const now = new Date();
    const isTodaySelected = isToday(selectedDate);

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotDecimal = h + m / 60;
        if (slotDecimal + durationHours > endHour) continue;
        if (isTodaySelected) {
          const currentDecimal = now.getHours() + now.getMinutes() / 60;
          if (slotDecimal <= currentDecimal) continue;
        }
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  }, [selectedDuration, startHour, endHour, selectedDate]);

  // Slot status helper
  const getSlotStatus = useCallback((slotStart: string): 'available' | 'booked' | 'maintenance' => {
    if (!selectedDuration) return 'available';
    const [sh, sm] = slotStart.split(':').map(Number);
    const startDec = sh + sm / 60;
    const endDec = startDec + selectedDuration / 60;
    const endH = Math.floor(endDec);
    const endM = Math.round((endDec % 1) * 60);
    const slotEnd = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    // Check maintenance first (priority)
    for (const ms of maintenanceSlots) {
      if (slotStart < ms.end_time && slotEnd > ms.start_time) return 'maintenance';
    }
    for (const bs of bookedSlots) {
      if (slotStart < bs.end_time && slotEnd > bs.start_time) return 'booked';
    }
    return 'available';
  }, [selectedDuration, bookedSlots, maintenanceSlots]);

  // Get unit number for a booked slot
  const getBookedUnit = (slotStart: string): string | undefined => {
    if (!selectedDuration) return undefined;
    const [sh, sm] = slotStart.split(':').map(Number);
    const startDec = sh + sm / 60;
    const endDec = startDec + selectedDuration / 60;
    const endH = Math.floor(endDec);
    const endM = Math.round((endDec % 1) * 60);
    const slotEnd = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    for (const bs of bookedSlots) {
      if (slotStart < bs.end_time && slotEnd > bs.start_time) return bs.unit_number;
    }
    return undefined;
  };

  // Format time to AM/PM
  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Get end time for a slot
  const getEndTime = (start: string): string => {
    if (!selectedDuration) return start;
    const [h, m] = start.split(':').map(Number);
    const endDec = h + m / 60 + selectedDuration / 60;
    const endH = Math.floor(endDec);
    const endM = Math.round((endDec % 1) * 60);
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  // Format duration label
  const fmtDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = mins / 60;
    return h === 1 ? '1 hr' : `${h} hr`;
  };

  // Confirm booking
  const handleConfirm = async () => {
    if (!currentUser || !amenityId || !selectedSlot || !selectedDuration || !amenity) return;
    setConfirming(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const endTime = getEndTime(selectedSlot);
      const timeSlot = {
        id: `${amenityId}-${dateStr}-${selectedSlot}`,
        start: new Date(`${dateStr}T${selectedSlot}:00`).toISOString(),
        end: new Date(`${dateStr}T${endTime}:00`).toISOString(),
        status: AmenityStatus.AVAILABLE,
      };
      await bookAmenity(
        currentUser.id, currentUser.fullName,
        amenity.id, amenity.name,
        dateStr, timeSlot, playType,
      );
      navigate(`/book/${amenityId}/confirmed`, {
        state: {
          amenityName: amenity.name,
          amenityType: amenityLabels[amenity.amenityType] || amenity.amenityType,
          date: dateStr,
          startTime: selectedSlot,
          endTime,
          duration: selectedDuration,
          playType,
        },
      });
    } catch {
      setConfirming(false);
    }
  };

  if (!amenity) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
        <p style={{ color: '#9CA3AF' }}>Amenity not found.</p>
      </div>
    );
  }

  const typeLabel = amenityLabels[amenity.amenityType] || amenity.amenityType;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F4F8' }}>
      {/* Header */}
      <ResidentHeader compact>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/book')}
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.12)',
            }}
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{amenity.name}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>{typeLabel} · Book a slot</div>
          </div>
        </div>
      </ResidentHeader>

      {/* Date strip */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Select Date
        </div>
        <div className="flex gap-2 overflow-x-auto" style={{ paddingBottom: 4 }}>
          {datePills.map((d, i) => {
            const sel = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
            const dayLabel = i === 0 ? 'Today' : DAY_LABELS[d.getDay()];
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className="flex flex-col items-center"
                style={{
                  flexShrink: 0, minWidth: 56, padding: '10px 12px', borderRadius: 14,
                  background: sel ? '#0A1628' : '#F0F4F8',
                  border: sel ? '2px solid #00B4D8' : '2px solid #E5E7EB',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: sel ? 'rgba(255,255,255,0.6)' : '#9CA3AF' }}>
                  {dayLabel}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: sel ? '#FFFFFF' : '#1A1A2E' }}>
                  {d.getDate()}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: sel ? '#00B4D8' : '#9CA3AF' }}>
                  {MONTH_ABBR[d.getMonth()]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px', paddingBottom: selectedSlot ? 180 : 100 }}>
        {/* Options card */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            Options
          </div>

          {/* Type of Play */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 8 }}>Type of Play</div>
          <div className="flex gap-2" style={{ marginBottom: 16 }}>
            {(['singles', 'doubles'] as const).map(t => {
              const sel = playType === t;
              return (
                <button
                  key={t}
                  onClick={() => setPlayType(t)}
                  className="flex-1 min-h-[44px]"
                  style={{
                    borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700,
                    background: sel ? '#0A1628' : '#F0F4F8',
                    border: sel ? '2px solid #00B4D8' : '2px solid #E5E7EB',
                    color: sel ? '#FFFFFF' : '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Duration */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 8 }}>Duration</div>
          <div className="flex gap-2" style={{ marginBottom: 6 }}>
            {durationOptions.map(d => {
              const sel = selectedDuration === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDuration(d)}
                  className="flex-1 min-h-[44px]"
                  style={{
                    borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700,
                    background: sel ? '#0A1628' : '#F0F4F8',
                    border: sel ? '2px solid #00B4D8' : '2px solid #E5E7EB',
                    color: sel ? '#FFFFFF' : '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  {fmtDuration(d)}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
            {playType === 'singles' ? `Singles max: ${fmtDuration(singlesMax)}` : `Doubles max: ${fmtDuration(doublesMax)}`}
          </div>
        </div>

        {/* Time grid */}
        {selectedDuration && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', padding: 16 }}>
            {/* Header + legend */}
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase' }}>
                Times
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {[
                  { label: 'Available', bg: '#F0F4F8', border: '#E5E7EB' },
                  { label: 'Selected', bg: '#0A1628', border: '#00B4D8' },
                  { label: 'Booked', bg: '#F3F4F6', border: '#EBEBEB' },
                  { label: 'Maintenance', bg: '#FEF2F2', border: '#EF4444' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}` }} />
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {timeSlots.map(slot => {
                const status = getSlotStatus(slot);
                const isSelected = selectedSlot === slot;
                const unit = status === 'booked' ? getBookedUnit(slot) : undefined;

                const styles: React.CSSProperties = {
                  borderRadius: 10, padding: '9px 4px 7px', textAlign: 'center', position: 'relative',
                  cursor: status === 'available' ? 'pointer' : 'default',
                };

                if (isSelected) {
                  Object.assign(styles, { background: '#0A1628', border: '2px solid #00B4D8' });
                } else if (status === 'maintenance') {
                  Object.assign(styles, { background: '#FEF2F2', border: '1.5px solid #EF4444' });
                } else if (status === 'booked') {
                  Object.assign(styles, { background: '#F3F4F6', border: '1.5px solid #EBEBEB' });
                } else {
                  Object.assign(styles, { background: '#F0F4F8', border: '1.5px solid #E5E7EB' });
                }

                return (
                  <button
                    key={slot}
                    disabled={status !== 'available'}
                    onClick={() => status === 'available' && setSelectedSlot(slot)}
                    style={styles}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                        borderRadius: 99, background: '#00B4D8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check className="h-2 w-2 text-white" />
                      </div>
                    )}
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: isSelected ? '#FFFFFF' : status === 'maintenance' ? '#EF4444' : status === 'booked' ? '#9CA3AF' : '#1A1A2E',
                    }}>
                      {formatTime(slot)}
                    </div>
                    {status === 'booked' && unit && (
                      <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF' }}>Unit {unit}</div>
                    )}
                    {status === 'maintenance' && (
                      <div style={{ fontSize: 8, fontWeight: 700, color: '#EF4444' }}>Maint.</div>
                    )}
                  </button>
                );
              })}
            </div>

            {timeSlots.length === 0 && (
              <div className="text-center" style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>
                No available slots for this date and duration.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky confirm bar */}
      {selectedSlot && selectedDuration && (
        <div
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            background: '#FFFFFF', borderTop: '1px solid #E5E7EB',
            padding: '12px 16px 28px',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                {formatTime(selectedSlot)} – {formatTime(getEndTime(selectedSlot))}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                {format(selectedDate, 'MMM d')} · {fmtDuration(selectedDuration)} · {playType}
              </div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: '#E6FFFA', color: '#2DD4BF',
            }}>
              Selected ✓
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full min-h-[44px]"
            style={{
              borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 800, border: 'none',
              background: 'linear-gradient(135deg, #00B4D8 0%, #0091B5 100%)',
              color: '#FFFFFF', cursor: confirming ? 'wait' : 'pointer',
              boxShadow: '0 4px 16px rgba(0,180,216,0.35)',
              opacity: confirming ? 0.7 : 1,
            }}
          >
            {confirming ? 'Confirming...' : 'Confirm Booking →'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BookingFlow;
