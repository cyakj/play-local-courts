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
  const [playType, setPlayType] = useState<'singles' | 'doubles' | 'family' | 'group'>('singles');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [maintenanceSlots, setMaintenanceSlots] = useState<MaintenanceSlot[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [userDailyCount, setUserDailyCount] = useState(0);
  const [userWeeklyCount, setUserWeeklyCount] = useState(0);

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

  // Amenity-type-aware play types — filtered by admin rules
  const isCourtSport = amenity?.amenityType === 'tennis' || amenity?.amenityType === 'pickleball';
  const playTypeOptions: { value: 'singles' | 'doubles' | 'family' | 'group'; label: string }[] = useMemo(() => {
    const r = rules as any;
    if (isCourtSport) {
      const opts = [{ value: 'singles' as const, label: 'Singles' }, { value: 'doubles' as const, label: 'Doubles' }];
      if (r?.singles_only) return opts.filter(o => o.value === 'singles');
      if (r?.doubles_only) return opts.filter(o => o.value === 'doubles');
      return opts;
    }
    return [{ value: 'family' as const, label: 'Family' }, { value: 'group' as const, label: 'Group' }];
  }, [rules, isCourtSport]);

  // Set default play type based on amenity type & available options
  useEffect(() => {
    if (playTypeOptions.length === 0) return;
    if (!playTypeOptions.find(o => o.value === playType)) {
      setPlayType(playTypeOptions[0].value);
    }
  }, [playTypeOptions]);

  // Duration options — per play type from admin rules
  const maxDuration = useMemo(() => {
    const r = rules as any;
    if (!r) return isCourtSport ? 60 : 120;
    if (isCourtSport) {
      return playType === 'singles'
        ? (r.singles_duration_minutes ?? 60)
        : (r.doubles_duration_minutes ?? 90);
    }
    return playType === 'family'
      ? (r.family_duration_minutes ?? 120)
      : (r.group_duration_minutes ?? 120);
  }, [rules, playType, isCourtSport]);

  const durationOptions = useMemo(() => {
    const opts: number[] = [];
    for (let d = 30; d <= maxDuration; d += 30) opts.push(d);
    if (opts.length === 0) opts.push(30);
    return opts;
  }, [maxDuration]);

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

      // For booked slots, fetch full_name from profiles to derive unit info
      const bookings = bookingsRes.data || [];
      const userIds = [...new Set(bookings.map(b => b.user_id))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach((p: any) => {
            if (p.full_name) profileMap[p.id] = p.full_name;
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

  // Fetch user's daily + weekly booking count for THIS amenity
  useEffect(() => {
    if (!amenityId || !currentUser?.id) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const fetchCounts = async () => {
      // Daily count
      const { count: dailyCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('court_id', amenityId)
        .eq('user_id', currentUser.id)
        .eq('date', dateStr)
        .eq('status', 'confirmed');
      setUserDailyCount(dailyCount || 0);

      // Weekly count (Mon–Sun window around selected date)
      const sel = new Date(selectedDate);
      const dayOfWeek = sel.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(sel);
      monday.setDate(sel.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekStart = format(monday, 'yyyy-MM-dd');
      const weekEnd = format(sunday, 'yyyy-MM-dd');

      const { count: weeklyCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('court_id', amenityId)
        .eq('user_id', currentUser.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .eq('status', 'confirmed');
      setUserWeeklyCount(weeklyCount || 0);
    };

    fetchCounts();
  }, [amenityId, currentUser?.id, selectedDate]);

  const maxPerDay = rules?.max_reservations_per_day ?? 1;
  const maxPerWeek = rules?.max_reservations_per_week ?? 3;
  const atDailyLimit = userDailyCount >= maxPerDay;
  const atWeeklyLimit = userWeeklyCount >= maxPerWeek;

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F9FAFB' }}>
        <p style={{ color: '#9CA3AF' }}>Amenity not found.</p>
      </div>
    );
  }

  const typeLabel = amenityLabels[amenity.amenityType] || amenity.amenityType;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9FAFB' }}>
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
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
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
                  background: sel ? '#0F1F3D' : '#F9FAFB',
                  border: sel ? '2px solid #00D4FF' : '2px solid #E5E7EB',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: sel ? 'rgba(255,255,255,0.6)' : '#9CA3AF' }}>
                  {dayLabel}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: sel ? '#FFFFFF' : '#0F1F3D' }}>
                  {d.getDate()}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: sel ? '#00D4FF' : '#9CA3AF' }}>
                  {MONTH_ABBR[d.getMonth()]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Limit warning banners */}
      {(atDailyLimit || atWeeklyLimit) && (
        <div style={{
          margin: '0 16px 0',
          padding: '12px 14px',
          background: '#FFFBEB',
          border: '1.5px solid #F59E0B',
          borderRadius: 12,
          marginTop: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
            Booking limit reached
          </div>
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>
            {atDailyLimit && (
              <span>You've reached your daily maximum of {maxPerDay} reservation{maxPerDay > 1 ? 's' : ''} for this amenity. </span>
            )}
            {!atDailyLimit && atWeeklyLimit && (
              <span>You've reached your weekly maximum of {maxPerWeek} reservation{maxPerWeek > 1 ? 's' : ''} for this amenity. </span>
            )}
            Please try another {atDailyLimit ? 'date' : 'week'}.
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px', paddingBottom: selectedSlot ? 240 : 100, opacity: (atDailyLimit || atWeeklyLimit) ? 0.5 : 1, pointerEvents: (atDailyLimit || atWeeklyLimit) ? 'none' : 'auto' }}>
        {/* Options card */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            Options
          </div>

          {/* Usage type */}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{isCourtSport ? 'Type of Play' : 'Type of Use'}</div>
          <div className="flex gap-2" style={{ marginBottom: 16 }}>
            {playTypeOptions.map(t => {
              const sel = playType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setPlayType(t.value)}
                  className="flex-1 min-h-[44px]"
                  style={{
                    borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700,
                    background: sel ? '#0F1F3D' : '#F9FAFB',
                    border: sel ? '2px solid #00D4FF' : '2px solid #E5E7EB',
                    color: sel ? '#FFFFFF' : '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Duration */}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Duration</div>
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
                    background: sel ? '#0F1F3D' : '#F9FAFB',
                    border: sel ? '2px solid #00D4FF' : '2px solid #E5E7EB',
                    color: sel ? '#FFFFFF' : '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  {fmtDuration(d)}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
            Max duration: {fmtDuration(maxDuration)}
          </div>
        </div>

        {/* Time grid */}
        {selectedDuration && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', padding: 16 }}>
            {/* Header + legend */}
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', letterSpacing: 1, textTransform: 'uppercase' }}>
                Times
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {[
                  { label: 'Available', bg: '#F9FAFB', border: '#E5E7EB' },
                  { label: 'Selected', bg: '#0F1F3D', border: '#00D4FF' },
                  { label: 'Booked', bg: '#F3F4F6', border: '#EBEBEB' },
                  { label: 'Maintenance', bg: '#FEF2F2', border: '#EF4444' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}` }} />
                    <span style={{ fontSize: 12, color: '#4B5563' }}>{l.label}</span>
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
                  Object.assign(styles, { background: '#0F1F3D', border: '2px solid #00D4FF' });
                } else if (status === 'maintenance') {
                  Object.assign(styles, { background: '#FEF2F2', border: '1.5px solid #EF4444' });
                } else if (status === 'booked') {
                  Object.assign(styles, { background: '#F3F4F6', border: '1.5px solid #EBEBEB' });
                } else {
                  Object.assign(styles, { background: '#F9FAFB', border: '1.5px solid #E5E7EB' });
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
                        borderRadius: 99, background: '#00D4FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check className="h-2 w-2 text-white" />
                      </div>
                    )}
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: isSelected ? '#FFFFFF' : status === 'maintenance' ? '#EF4444' : status === 'booked' ? '#9CA3AF' : '#0F1F3D',
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
              <div className="text-center" style={{ padding: 24, color: '#4B5563', fontSize: 14 }}>
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
            padding: '12px 16px 96px',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1F3D' }}>
                {formatTime(selectedSlot)} – {formatTime(getEndTime(selectedSlot))}
              </div>
              <div style={{ fontSize: 12, color: '#4B5563' }}>
                {format(selectedDate, 'MMM d')} · {fmtDuration(selectedDuration)} · {playType}
              </div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: '#E6FFFA', color: '#00D4FF',
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
              background: 'linear-gradient(135deg, #00D4FF 0%, #0091B5 100%)',
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
