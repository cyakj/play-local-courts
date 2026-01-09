import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface AmenityRules {
  booking_start_time?: string;
  booking_end_time?: string;
  singles_duration_minutes?: number;
  doubles_duration_minutes?: number;
  family_duration_minutes?: number;
  group_duration_minutes?: number;
  peak_start_time?: string;
  peak_end_time?: string;
  peak_singles_duration_minutes?: number;
  peak_doubles_duration_minutes?: number;
  peak_family_duration_minutes?: number;
  peak_group_duration_minutes?: number;
  enable_peak_hours?: boolean;
}

interface TimeSelectorProps {
  selectedDate: Date;
  onTimeSelect: (startTime: string, endTime: string) => void;
  onClearSelection: () => void;
  maxDurationMinutes: number;
  amenityRules?: AmenityRules | null;
  bookedSlots: Array<{ start: string; end: string }>;
  maintenanceSlots: Array<{ start: string; end: string }>;
  selectedStartTime?: string;
  selectedEndTime?: string;
}

type TimeSlot = { time: string; displayTime: string };

type TimePeriod = {
  label: string;
  slots: TimeSlot[];
  range: string;
};

const TimeSelector: React.FC<TimeSelectorProps> = ({
  selectedDate,
  onTimeSelect,
  onClearSelection,
  maxDurationMinutes,
  amenityRules,
  bookedSlots,
  maintenanceSlots,
  selectedStartTime,
  selectedEndTime
}) => {
  // Get operating hours from rules or use defaults
  const startHour = amenityRules?.booking_start_time 
    ? parseInt(amenityRules.booking_start_time.split(':')[0]) 
    : 6;
  const endHour = amenityRules?.booking_end_time 
    ? parseInt(amenityRules.booking_end_time.split(':')[0]) 
    : 22;
  
  const maxDurationHours = maxDurationMinutes / 60;

  // Check if a time slot overlaps with booked or maintenance slots
  const isSlotUnavailable = useCallback((slotStart: string, slotEnd: string): 'booked' | 'maintenance' | false => {
    for (const slot of bookedSlots) {
      if (slotStart < slot.end && slotEnd > slot.start) {
        return 'booked';
      }
    }
    for (const slot of maintenanceSlots) {
      if (slotStart < slot.end && slotEnd > slot.start) {
        return 'maintenance';
      }
    }
    return false;
  }, [bookedSlots, maintenanceSlots]);

  // Generate time slots grouped by period of day
  const groupedTimeSlots = useMemo(() => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];
    const evening: TimeSlot[] = [];
    
    const durationHours = maxDurationMinutes / 60;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTimeDecimal = hour + minute / 60;
        const slotEndTimeDecimal = slotTimeDecimal + durationHours;
        
        // Skip slots where starting + duration would exceed booking end time
        if (slotEndTimeDecimal > endHour) continue;
        
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${amPm}`;
        
        const slot = { time: timeStr, displayTime };
        
        // Categorize by period
        if (hour < 12) {
          morning.push(slot);
        } else if (hour < 17) {
          afternoon.push(slot);
        } else {
          evening.push(slot);
        }
      }
    }
    
    const periods: TimePeriod[] = [];
    if (morning.length > 0) {
      periods.push({ label: 'Morning', slots: morning, range: '6:00 AM – 11:30 AM' });
    }
    if (afternoon.length > 0) {
      periods.push({ label: 'Afternoon', slots: afternoon, range: '12:00 PM – 4:30 PM' });
    }
    if (evening.length > 0) {
      periods.push({ label: 'Evening', slots: evening, range: '5:00 PM – 9:00 PM' });
    }
    
    return periods;
  }, [startHour, endHour, maxDurationMinutes]);

  // Determine which period the selected time is in
  const selectedPeriod = useMemo(() => {
    if (!selectedStartTime) return null;
    const hour = parseInt(selectedStartTime.split(':')[0]);
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }, [selectedStartTime]);

  const handleSlotClick = (slotTime: string) => {
    const [hours, minutes] = slotTime.split(':').map(Number);
    const startTimeNum = hours + minutes / 60;
    const endTimeNum = Math.min(startTimeNum + maxDurationHours, endHour);
    
    const endHours = Math.floor(endTimeNum);
    const endMinutes = Math.round((endTimeNum % 1) * 60);
    const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    
    const unavailable = isSlotUnavailable(slotTime, endTimeStr);
    if (!unavailable) {
      onTimeSelect(slotTime, endTimeStr);
    }
  };

  const isSlotSelected = (slotTime: string): boolean => {
    if (!selectedStartTime) return false;
    return slotTime === selectedStartTime;
  };

  const renderSlot = (slot: TimeSlot) => {
    const nextSlotMinutes = parseInt(slot.time.split(':')[1]) + 30;
    const nextSlotHour = parseInt(slot.time.split(':')[0]) + Math.floor(nextSlotMinutes / 60);
    const nextSlotMin = nextSlotMinutes % 60;
    const slotEndTime = `${nextSlotHour.toString().padStart(2, '0')}:${nextSlotMin.toString().padStart(2, '0')}`;
    
    const unavailableReason = isSlotUnavailable(slot.time, slotEndTime);
    const isBooked = unavailableReason === 'booked';
    const isMaintenance = unavailableReason === 'maintenance';
    const isSelected = isSlotSelected(slot.time);
    const isAvailable = !unavailableReason;
    
    return (
      <button
        key={slot.time}
        type="button"
        disabled={!!unavailableReason}
        onClick={() => handleSlotClick(slot.time)}
        className={cn(
          "relative py-2.5 px-1 text-xs font-medium rounded-lg border transition-all text-center",
          isSelected && "bg-green-50 border-green-500 border-2 text-green-700",
          isBooked && "bg-muted text-muted-foreground cursor-not-allowed border-muted",
          isMaintenance && "bg-orange-50 text-orange-600 cursor-not-allowed border-orange-200",
          isAvailable && !isSelected && "bg-background hover:bg-muted/50 border-border cursor-pointer"
        )}
      >
        <span className="block">{slot.displayTime}</span>
        {isBooked && (
          <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Booked</span>
        )}
        {isMaintenance && (
          <span className="block text-[9px] uppercase tracking-wide text-orange-500">Maint.</span>
        )}
        {isSelected && (
          <>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="block text-[9px] uppercase tracking-wide text-green-600">Chosen</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {groupedTimeSlots.map((period) => {
        const hasSelectedSlot = selectedPeriod === period.label;
        const defaultOpen = hasSelectedSlot || groupedTimeSlots.length === 1;
        
        return (
          <Collapsible key={period.label} defaultOpen={defaultOpen} className="border rounded-lg overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{period.label}</span>
                <span className="text-xs text-muted-foreground">({period.range})</span>
                {hasSelectedSlot && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{period.slots.length} slots</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {period.slots.map(renderSlot)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      
      {groupedTimeSlots.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No available time slots for the selected duration.
        </p>
      )}
    </div>
  );
};

export default TimeSelector;
