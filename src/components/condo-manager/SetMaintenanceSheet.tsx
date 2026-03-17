import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, isToday } from 'date-fns';

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

interface SlotState {
  time: string;
  label: string;
  maintenance: boolean;
}

const generateTimeSlots = (startHour = 6, endHour = 22): SlotState[] => {
  const slots: SlotState[] = [];
  for (let h = startHour; h < endHour; h++) {
    const start = h % 12 === 0 ? 12 : h % 12;
    const end = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
    const startSuffix = h < 12 ? 'AM' : 'PM';
    const endSuffix = (h + 1) < 12 ? 'AM' : 'PM';
    slots.push({
      time: `${String(h).padStart(2, '0')}:00`,
      label: `${String(start).padStart(2, '0')}:00 ${startSuffix} – ${String(end).padStart(2, '0')}:00 ${endSuffix}`,
      maintenance: false,
    });
  }
  return slots;
};

const SetMaintenanceSheet: React.FC<SetMaintenanceSheetProps> = ({ open, onClose, amenity }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<SlotState[]>(generateTimeSlots());
  const [loading, setLoading] = useState(false);
  const dateStripRef = useRef<HTMLDivElement>(null);

  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  // Fetch existing maintenance for the selected date
  useEffect(() => {
    if (!open) return;
    const fetchMaintenance = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('court_maintenance')
        .select('start_time, end_time')
        .eq('court_id', amenity.id)
        .eq('date', dateStr);

      const fresh = generateTimeSlots();
      if (data) {
        data.forEach((m) => {
          const startH = parseInt(m.start_time.split(':')[0], 10);
          const idx = fresh.findIndex((s) => parseInt(s.time.split(':')[0], 10) === startH);
          if (idx >= 0) fresh[idx].maintenance = true;
        });
      }
      setSlots(fresh);
    };
    fetchMaintenance();
  }, [open, selectedDate, amenity.id]);

  const toggleSlot = (idx: number) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, maintenance: !s.maintenance } : s)));
  };

  const handleSave = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Delete existing maintenance for this amenity+date
    await supabase.from('court_maintenance').delete().eq('court_id', amenity.id).eq('date', dateStr);

    // Insert new maintenance slots
    const maintenanceSlots = slots.filter((s) => s.maintenance);
    if (maintenanceSlots.length > 0) {
      const rows = maintenanceSlots.map((s) => {
        const h = parseInt(s.time.split(':')[0], 10);
        return {
          court_id: amenity.id,
          date: dateStr,
          start_time: `${String(h).padStart(2, '0')}:00`,
          end_time: `${String(h + 1).padStart(2, '0')}:00`,
          description: 'Scheduled maintenance',
        };
      });
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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl" style={{ height: '75vh' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#E5E7EB]" />
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

          {/* Time slot grid */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {slots.map((slot, idx) => {
              const past = isSlotInPast(slot.time, selectedDate);
              return (
                <div
                  key={slot.time}
                  onClick={() => !past && toggleSlot(idx)}
                  className="border transition-colors"
                  style={{
                    backgroundColor: past ? '#F3F4F6' : '#FFFFFF',
                    borderColor: '#E5E7EB',
                    borderRadius: 10,
                    padding: '10px 12px',
                    borderWidth: 1,
                    opacity: past ? 0.5 : 1,
                    cursor: past ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div className="text-xs font-bold" style={{ color: past ? '#9CA3AF' : '#1A1A2E' }}>{slot.label}</div>
                  <div className="mt-1.5">
                    {past ? (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ color: '#9CA3AF' }}>
                        Passed
                      </span>
                    ) : slot.maintenance ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold text-white"
                        style={{ backgroundColor: '#F59E0B' }}
                      >
                        Maintenance
                      </span>
                    ) : (
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border"
                        style={{ color: '#2DD4BF', borderColor: '#2DD4BF' }}
                      >
                        Available
                      </span>
                    )}
                  </div>
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
    </>
  );
};

export default SetMaintenanceSheet;
