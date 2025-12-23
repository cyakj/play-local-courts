import React, { useState, useRef, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock } from 'lucide-react';

interface CoachAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface LessonTimeSelectorProps {
  selectedDate: Date;
  coachAvailability: CoachAvailability[];
  onTimeSelect: (startTime: string, endTime: string, isOutsideAvailability: boolean) => void;
  selectedStartTime?: string;
  selectedEndTime?: string;
}

const LessonTimeSelector: React.FC<LessonTimeSelectorProps> = ({
  selectedDate,
  coachAvailability,
  onTimeSelect,
  selectedStartTime,
  selectedEndTime
}) => {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = selectedDate.getDay();
  
  // Find availability for selected day
  const dayAvailability = coachAvailability.filter(a => a.day_of_week === dayOfWeek);
  
  // Default hours if no availability set
  const defaultStartHour = 9;
  const defaultEndHour = 17;
  
  // Get operating hours from coach availability or use defaults
  let startHour = defaultStartHour;
  let endHour = defaultEndHour;
  
  if (dayAvailability.length > 0) {
    const starts = dayAvailability.map(a => parseInt(a.start_time.split(':')[0]));
    const ends = dayAvailability.map(a => parseInt(a.end_time.split(':')[0]));
    startHour = Math.min(...starts);
    endHour = Math.max(...ends);
  }
  
  const totalHours = endHour - startHour;
  
  // 30-minute increments
  const slotDurationHours = 0.5;

  const getTimeFromPosition = useCallback((position: number): number => {
    if (!timelineRef.current) return startHour;
    const rect = timelineRef.current.getBoundingClientRect();
    const relativePosition = Math.max(0, Math.min(1, position / rect.height));
    const time = startHour + (relativePosition * totalHours);
    // Snap to 30-minute increments
    const minutes = (time % 1) * 60;
    const snappedMinutes = Math.round(minutes / 30) * 30;
    return Math.floor(time) + (snappedMinutes / 60);
  }, [startHour, totalHours]);

  const getPositionFromTime = useCallback((hour: number): number => {
    return ((hour - startHour) / totalHours) * 100;
  }, [startHour, totalHours]);

  // Format time value to string (handles 30-min increments)
  const formatTimeValue = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Format time to AM/PM
  const formatTimeToAmPm = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isTimeSlotWithinAvailability = useCallback((start: number, end: number): boolean => {
    const startTime = formatTimeValue(start);
    const endTime = formatTimeValue(end);
    
    // Check if time falls within any coach availability slot
    for (const slot of dayAvailability) {
      if (startTime >= slot.start_time && endTime <= slot.end_time) {
        return true;
      }
    }
    
    return false;
  }, [dayAvailability]);

  // Check if current selection is outside availability
  const isSelectionOutsideAvailability = useCallback((): boolean => {
    if (!selectedStartTime || !selectedEndTime) return false;
    if (dayAvailability.length === 0) return true; // No availability set
    
    const startHr = parseInt(selectedStartTime.split(':')[0]);
    const endHr = parseInt(selectedEndTime.split(':')[0]);
    return !isTimeSlotWithinAvailability(startHr, endHr);
  }, [selectedStartTime, selectedEndTime, dayAvailability, isTimeSlotWithinAvailability]);

  const handleTimeSlotClick = (time: number) => {
    // Check if clicking on already selected start time to extend
    if (selectedStartTime && selectedEndTime) {
      const [startH, startM] = selectedStartTime.split(':').map(Number);
      const [endH, endM] = selectedEndTime.split(':').map(Number);
      const currentStart = startH + startM / 60;
      const currentEnd = endH + endM / 60;
      
      // If clicking adjacent slot, extend selection
      if (Math.abs(time - currentEnd) < 0.01) {
        const newEnd = time + slotDurationHours;
        const endTimeStr = formatTimeValue(newEnd);
        const isOutside = !isTimeSlotWithinAvailability(currentStart, newEnd);
        onTimeSelect(selectedStartTime, endTimeStr, isOutside);
        return;
      }
    }
    
    // Otherwise start new selection - allow all times
    const endTimeVal = time + slotDurationHours;
    
    const startTimeStr = formatTimeValue(time);
    const endTimeStr = formatTimeValue(endTimeVal);
    const isOutside = !isTimeSlotWithinAvailability(time, endTimeVal);
    onTimeSelect(startTimeStr, endTimeStr, isOutside);
  };

  const renderTimeLabels = () => {
    const labels = [];
    // Show labels at 30-min intervals
    for (let time = startHour; time <= endHour; time += 0.5) {
      const position = getPositionFromTime(time);
      const hours = Math.floor(time);
      const minutes = Math.round((time % 1) * 60);
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      const period = hours >= 12 ? 'PM' : 'AM';
      labels.push(
        <div
          key={time}
          className="absolute text-xs text-muted-foreground whitespace-nowrap"
          style={{ top: `${position}%`, transform: 'translateY(-50%)', left: '0' }}
        >
          {displayHour}:{minutes.toString().padStart(2, '0')} {period}
        </div>
      );
    }
    return labels;
  };

  const renderTimeSlots = () => {
    const slots = [];
    // Create 30-minute slots
    for (let time = startHour; time < endHour; time += 0.5) {
      const position = getPositionFromTime(time);
      const height = (0.5 / totalHours) * 100;
      const endTimeVal = time + slotDurationHours;
      const withinAvailability = isTimeSlotWithinAvailability(time, endTimeVal);
      const noAvailabilitySet = dayAvailability.length === 0;
      
      // Check if this slot is selected
      const isSelected = selectedStartTime && selectedEndTime && (() => {
        const [startH, startM] = selectedStartTime.split(':').map(Number);
        const [endH, endM] = selectedEndTime.split(':').map(Number);
        const selectedStart = startH + startM / 60;
        const selectedEnd = endH + endM / 60;
        return time >= selectedStart && time < selectedEnd;
      })();
      
      // Determine slot color:
      // - Selected within availability: green-500
      // - Selected outside availability (including no availability set): amber-500
      // - Available (within coach availability): green-100
      // - Outside availability or no availability set: amber-50/amber-100
      const getSlotClasses = () => {
        if (isSelected) {
          // When selected, green if within availability, amber if outside (or no availability)
          return withinAvailability && !noAvailabilitySet
            ? 'bg-green-500 hover:bg-green-600 z-10' 
            : 'bg-amber-500 hover:bg-amber-600 z-10';
        }
        // Not selected
        if (withinAvailability && !noAvailabilitySet) {
          return 'bg-green-100 hover:bg-green-200';
        }
        // Outside availability OR no availability set = amber
        return 'bg-amber-50 hover:bg-amber-100';
      };

      const hours = Math.floor(time);
      const minutes = Math.round((time % 1) * 60);
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      const period = hours >= 12 ? 'PM' : 'AM';
      
      slots.push(
        <div
          key={time}
          className={`absolute w-full border border-border cursor-pointer transition-all ${getSlotClasses()}`}
          style={{
            top: `${position}%`,
            height: `${height}%`,
          }}
          onClick={() => handleTimeSlotClick(time)}
        >
          {isSelected && (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs font-semibold text-white">
                {`${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`}
              </span>
            </div>
          )}
        </div>
      );
    }
    return slots;
  };

  const outsideAvailability = isSelectionOutsideAvailability();

  return (
    <div className="space-y-4">
      {dayAvailability.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This coach has not set availability for this day. You can still select a time and your request will be sent for manual review.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="text-sm font-medium">
        Select your time slot(s) - Click slots to select 30-minute increments
      </div>
      
      <div className="relative flex items-start">
        {/* Time labels - positioned on the left */}
        <div className="relative w-14 h-96 flex-shrink-0">
          {renderTimeLabels()}
        </div>
        
        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative flex-1 h-96 bg-background border rounded"
        >
          {/* Time slots */}
          <div className="absolute inset-0">
            {renderTimeSlots()}
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-border rounded"></div>
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-50 border border-border rounded"></div>
          <span className="text-muted-foreground">Outside Availability</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 border border-border rounded"></div>
          <span className="text-muted-foreground">Selected</span>
        </div>
      </div>
      
      {selectedStartTime && selectedEndTime && (
        <Alert variant={outsideAvailability ? "default" : "default"} className={outsideAvailability ? "border-amber-500 bg-amber-50" : ""}>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Selected: {formatTimeToAmPm(selectedStartTime)} - {formatTimeToAmPm(selectedEndTime)}
            {outsideAvailability && (
              <span className="block mt-1 text-amber-700 font-medium">
                This time is outside the coach's posted availability. Your request will be sent for manual review.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default LessonTimeSelector;
