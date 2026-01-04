import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';

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
    // Check against booked slots
    for (const slot of bookedSlots) {
      if (slotStart < slot.end && slotEnd > slot.start) {
        return 'booked';
      }
    }
    
    // Check against maintenance slots
    for (const slot of maintenanceSlots) {
      if (slotStart < slot.end && slotEnd > slot.start) {
        return 'maintenance';
      }
    }
    
    return false;
  }, [bookedSlots, maintenanceSlots]);

  // Calculate the latest start time based on max duration
  const maxDurationHoursCalc = maxDurationMinutes / 60;
  const latestStartHour = endHour - maxDurationHoursCalc;

  // Generate time slots with 30-minute increments
  const generateTimeSlots = () => {
    const slots: { time: string; displayTime: string }[] = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTime = hour + minute / 60;
        // Skip slots where starting would exceed booking end time with selected duration
        if (slotTime > latestStartHour) continue;
        
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${amPm}`;
        slots.push({ time: timeStr, displayTime });
      }
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleSlotClick = (slotTime: string) => {
    const [hours, minutes] = slotTime.split(':').map(Number);
    const startTimeNum = hours + minutes / 60;
    const endTimeNum = Math.min(startTimeNum + maxDurationHours, endHour);
    
    const endHours = Math.floor(endTimeNum);
    const endMinutes = Math.round((endTimeNum % 1) * 60);
    const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    
    // Check if the entire range is available
    const unavailable = isSlotUnavailable(slotTime, endTimeStr);
    if (!unavailable) {
      onTimeSelect(slotTime, endTimeStr);
    }
  };

  const isSlotSelected = (slotTime: string): boolean => {
    if (!selectedStartTime) return false;
    return slotTime === selectedStartTime;
  };

  return (
    <div className="space-y-2">
      {/* Time slots grid - matching screenshot layout */}
      <div className="grid grid-cols-6 gap-1.5">
        {timeSlots.map((slot) => {
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
        })}
      </div>
    </div>
  );
};

export default TimeSelector;
