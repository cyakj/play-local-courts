import React, { useState, useRef, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CoachAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface LessonTimeSelectorProps {
  selectedDate: Date;
  coachAvailability: CoachAvailability[];
  onTimeSelect: (startTime: string, endTime: string) => void;
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

  const isTimeSlotAvailable = useCallback((start: number, end: number): boolean => {
    const startTime = `${start.toString().padStart(2, '0')}:00`;
    const endTime = `${end.toString().padStart(2, '0')}:00`;
    
    // Check if time falls within any coach availability slot
    for (const slot of dayAvailability) {
      if (startTime >= slot.start_time && endTime <= slot.end_time) {
        return true;
      }
    }
    
    return dayAvailability.length === 0; // If no availability set, allow all times
  }, [dayAvailability]);

  const handleTimeSlotClick = (hour: number) => {
    // Check if clicking on already selected start time to extend
    if (selectedStartTime) {
      const currentStartHour = parseInt(selectedStartTime.split(':')[0]);
      const currentEndHour = selectedEndTime ? parseInt(selectedEndTime.split(':')[0]) : currentStartHour + 1;
      
      // If clicking adjacent slot, extend selection
      if (hour === currentEndHour) {
        const newEndHour = hour + 1;
        if (isTimeSlotAvailable(currentStartHour, newEndHour)) {
          const endTimeStr = `${newEndHour.toString().padStart(2, '0')}:00`;
          onTimeSelect(selectedStartTime, endTimeStr);
          return;
        }
      }
    }
    
    // Otherwise start new selection
    const startTime = hour;
    const endTime = hour + slotDurationHours;
    
    if (isTimeSlotAvailable(startTime, endTime)) {
      const startTimeStr = `${startTime.toString().padStart(2, '0')}:00`;
      const endTimeStr = `${endTime.toString().padStart(2, '0')}:00`;
      onTimeSelect(startTimeStr, endTimeStr);
    }
  };

  const renderTimeLabels = () => {
    const labels = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const position = getPositionFromTime(hour);
      labels.push(
        <div
          key={hour}
          className="absolute text-xs text-muted-foreground flex items-center"
          style={{ top: `${position}%`, transform: 'translateY(-50%)', right: '100%', paddingRight: '8px' }}
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
      const endTime = hour + slotDurationHours;
      const available = isTimeSlotAvailable(hour, endTime);
      
      // Check if this slot is selected
      const isSelected = selectedStartTime && selectedEndTime && 
        hour >= parseInt(selectedStartTime.split(':')[0]) && 
        hour < parseInt(selectedEndTime.split(':')[0]);
      
      slots.push(
        <div
          key={hour}
          className={`absolute w-full border border-border cursor-pointer transition-all ${
            isSelected 
              ? 'bg-green-500 hover:bg-green-600 z-10' 
              : available 
                ? 'bg-green-100 hover:bg-green-200' 
                : 'bg-red-100 cursor-not-allowed'
          }`}
          style={{
            top: `${position}%`,
            height: `${height}%`,
          }}
          onClick={() => available && handleTimeSlotClick(hour)}
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

  return (
    <div className="space-y-4">
      {dayAvailability.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This coach has not set availability for this day. You can still select a time and the coach will respond.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="text-sm font-medium">
        Select your time slot(s) - Click slots to select 1-hour increments
      </div>
      
      <div className="relative flex items-start">
        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative w-full h-96 bg-background border rounded"
        >
          {/* Time labels */}
          <div className="absolute inset-0 pl-16">
            {renderTimeLabels()}
          </div>
          
          {/* Time slots */}
          <div className="absolute inset-0 pl-16">
            {renderTimeSlots()}
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-border rounded"></div>
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 border border-border rounded"></div>
          <span className="text-muted-foreground">Selected</span>
        </div>
      </div>
      
      {selectedStartTime && selectedEndTime && (
        <Alert>
          <AlertDescription>
            Selected: {selectedStartTime} - {selectedEndTime}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default LessonTimeSelector;
