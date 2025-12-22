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
  
  // 1 hour increments
  const slotDurationHours = 1;

  const getTimeFromPosition = useCallback((position: number): number => {
    if (!timelineRef.current) return startHour;
    const rect = timelineRef.current.getBoundingClientRect();
    const relativePosition = Math.max(0, Math.min(1, position / rect.height));
    const time = startHour + (relativePosition * totalHours);
    // Snap to 1-hour increments
    return Math.floor(time);
  }, [startHour, totalHours]);

  const getPositionFromTime = useCallback((hour: number): number => {
    return ((hour - startHour) / totalHours) * 100;
  }, [startHour, totalHours]);

  const isTimeSlotWithinAvailability = useCallback((start: number, end: number): boolean => {
    const startTime = `${start.toString().padStart(2, '0')}:00`;
    const endTime = `${end.toString().padStart(2, '0')}:00`;
    
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

  const handleTimeSlotClick = (hour: number) => {
    // Check if clicking on already selected start time to extend
    if (selectedStartTime) {
      const currentStartHour = parseInt(selectedStartTime.split(':')[0]);
      const currentEndHour = selectedEndTime ? parseInt(selectedEndTime.split(':')[0]) : currentStartHour + 1;
      
      // If clicking adjacent slot, extend selection
      if (hour === currentEndHour) {
        const newEndHour = hour + 1;
        const endTimeStr = `${newEndHour.toString().padStart(2, '0')}:00`;
        const isOutside = !isTimeSlotWithinAvailability(currentStartHour, newEndHour);
        onTimeSelect(selectedStartTime, endTimeStr, isOutside);
        return;
      }
    }
    
    // Otherwise start new selection - allow all times
    const startTime = hour;
    const endTimeVal = hour + slotDurationHours;
    
    const startTimeStr = `${startTime.toString().padStart(2, '0')}:00`;
    const endTimeStr = `${endTimeVal.toString().padStart(2, '0')}:00`;
    const isOutside = !isTimeSlotWithinAvailability(startTime, endTimeVal);
    onTimeSelect(startTimeStr, endTimeStr, isOutside);
  };

  const renderTimeLabels = () => {
    const labels = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const position = getPositionFromTime(hour);
      labels.push(
        <div
          key={hour}
          className="absolute text-xs text-muted-foreground whitespace-nowrap"
          style={{ top: `${position}%`, transform: 'translateY(-50%)', left: '0' }}
        >
          {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : hour === 0 ? '12 AM' : `${hour} AM`}
        </div>
      );
    }
    return labels;
  };

  const renderTimeSlots = () => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      const position = getPositionFromTime(hour);
      const height = (1 / totalHours) * 100;
      const endTimeVal = hour + slotDurationHours;
      const withinAvailability = isTimeSlotWithinAvailability(hour, endTimeVal);
      const noAvailabilitySet = dayAvailability.length === 0;
      
      // Check if this slot is selected
      const isSelected = selectedStartTime && selectedEndTime && 
        hour >= parseInt(selectedStartTime.split(':')[0]) && 
        hour < parseInt(selectedEndTime.split(':')[0]);
      
      slots.push(
        <div
          key={hour}
          className={`absolute w-full border border-border cursor-pointer transition-all ${
            isSelected 
              ? withinAvailability || noAvailabilitySet
                ? 'bg-green-500 hover:bg-green-600 z-10' 
                : 'bg-amber-500 hover:bg-amber-600 z-10'
              : withinAvailability 
                ? 'bg-green-100 hover:bg-green-200' 
                : noAvailabilitySet
                  ? 'bg-muted hover:bg-muted/80'
                  : 'bg-amber-50 hover:bg-amber-100'
          }`}
          style={{
            top: `${position}%`,
            height: `${height}%`,
          }}
          onClick={() => handleTimeSlotClick(hour)}
        >
          {isSelected && (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs font-semibold text-white">
                {`${hour.toString().padStart(2, '0')}:00`}
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
        Select your time slot(s) - Click slots to select 1-hour increments
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
            Selected: {selectedStartTime} - {selectedEndTime}
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
