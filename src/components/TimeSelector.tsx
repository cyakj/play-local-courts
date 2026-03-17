import React, { useCallback, useMemo, useState } from 'react';
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

  // Helper to format time for range display
  const formatRangeTime = (slot: TimeSlot) => slot.displayTime;

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
        
        // Categorize by period (Morning < 12, Afternoon 12-16:59, Evening 17+)
        if (hour < 12) {
          morning.push(slot);
        } else if (hour < 17) {
          afternoon.push(slot);
        } else {
          evening.push(slot);
        }
      }
    }
    
    // Build periods with dynamic ranges based on actual slots
    const periods: TimePeriod[] = [];
    if (morning.length > 0) {
      const range = `${formatRangeTime(morning[0])} – ${formatRangeTime(morning[morning.length - 1])}`;
      periods.push({ label: 'Morning', slots: morning, range });
    }
    if (afternoon.length > 0) {
      const range = `${formatRangeTime(afternoon[0])} – ${formatRangeTime(afternoon[afternoon.length - 1])}`;
      periods.push({ label: 'Afternoon', slots: afternoon, range });
    }
    if (evening.length > 0) {
      const range = `${formatRangeTime(evening[0])} – ${formatRangeTime(evening[evening.length - 1])}`;
      periods.push({ label: 'Evening', slots: evening, range });
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
          "relative py-2.5 px-1 text-xs font-medium rounded-lg transition-all text-center",
          isSelected && "border-2 text-green-700",
          isBooked && "cursor-not-allowed",
          isMaintenance && "cursor-not-allowed",
          isAvailable && !isSelected && "hover:bg-muted/50 cursor-pointer"
        )}
        style={{
          backgroundColor: isSelected ? '#E6FFFA' : isBooked ? '#EFF6FF' : isMaintenance ? '#FEF2F2' : undefined,
          borderColor: isSelected ? '#2DD4BF' : isBooked ? '#93C5FD' : isMaintenance ? '#EF4444' : undefined,
          borderWidth: isSelected ? 2 : (isBooked || isMaintenance) ? 1.5 : 1,
          borderStyle: 'solid',
        }}
      >
        <span className="block">{slot.displayTime}</span>
        {isBooked && (
          <span
            className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5"
            style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}
          >
            Booked
          </span>
        )}
        {isMaintenance && (
          <span
            className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5"
            style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
          >
            Maint.
          </span>
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

  // Track which periods have been benchmarked to avoid duplicate logs
  const [benchmarkedPeriods, setBenchmarkedPeriods] = useState<Set<string>>(new Set());

  const handlePeriodOpen = (periodLabel: string, isOpen: boolean) => {
    if (isOpen && !benchmarkedPeriods.has(periodLabel)) {
      console.time('CourtGridFetch');
      // Simulate the availability calculation timing
      setTimeout(() => {
        console.timeEnd('CourtGridFetch');
        setBenchmarkedPeriods(prev => new Set(prev).add(periodLabel));
      }, 0);
    }
  };

  return (
    <div className="space-y-3">
      {groupedTimeSlots.map((period) => {
        const hasSelectedSlot = selectedPeriod === period.label;
        const defaultOpen = hasSelectedSlot || groupedTimeSlots.length === 1;
        
        return (
          <Collapsible 
            key={period.label} 
            defaultOpen={defaultOpen} 
            className="border rounded-lg overflow-hidden"
            onOpenChange={(isOpen) => handlePeriodOpen(period.label, isOpen)}
          >
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
