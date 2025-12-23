
import React, { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get operating hours from rules or use defaults
  const startHour = amenityRules?.booking_start_time 
    ? parseInt(amenityRules.booking_start_time.split(':')[0]) 
    : 6;
  const endHour = amenityRules?.booking_end_time 
    ? parseInt(amenityRules.booking_end_time.split(':')[0]) 
    : 22;
  const totalHours = endHour - startHour;
  
  // Duration in hours (now supporting 15-minute increments)
  const maxDurationHours = maxDurationMinutes / 60;

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

  const isTimeSlotAvailable = useCallback((start: number, end: number): boolean => {
    const startTime = `${Math.floor(start).toString().padStart(2, '0')}:${Math.round((start % 1) * 60).toString().padStart(2, '0')}`;
    const endTime = `${Math.floor(end).toString().padStart(2, '0')}:${Math.round((end % 1) * 60).toString().padStart(2, '0')}`;
    
    // Check against booked slots
    for (const slot of bookedSlots) {
      if ((startTime < slot.end && endTime > slot.start)) {
        return false;
      }
    }
    
    // Check against maintenance slots
    for (const slot of maintenanceSlots) {
      if ((startTime < slot.end && endTime > slot.start)) {
        return false;
      }
    }
    
    return true;
  }, [bookedSlots, maintenanceSlots]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top;
    const time = getTimeFromPosition(y);
    
    setDragStart(time);
    setDragEnd(time + maxDurationHours);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStart === null) return;
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top;
    const time = getTimeFromPosition(y);
    
    if (time > dragStart) {
      // Limit the end time to max duration and operating hours
      const newEnd = Math.min(time, dragStart + maxDurationHours, endHour);
      setDragEnd(newEnd);
    }
  };

  const handleMouseUp = () => {
    if (dragStart !== null && dragEnd !== null && isDragging) {
      const startTime = `${Math.floor(dragStart).toString().padStart(2, '0')}:${Math.round((dragStart % 1) * 60).toString().padStart(2, '0')}`;
      const endTime = `${Math.floor(dragEnd).toString().padStart(2, '0')}:${Math.round((dragEnd % 1) * 60).toString().padStart(2, '0')}`;
      
      if (isTimeSlotAvailable(dragStart, dragEnd)) {
        onTimeSelect(startTime, endTime);
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // Simple time slot selection (alternative to dragging) - now with 15-minute increments
  const handleTimeSlotClick = (hour: number) => {
    const startTime = hour;
    const endTime = Math.min(hour + maxDurationHours, endHour);
    
    if (isTimeSlotAvailable(startTime, endTime)) {
      const startTimeStr = `${Math.floor(startTime).toString().padStart(2, '0')}:${Math.round((startTime % 1) * 60).toString().padStart(2, '0')}`;
      const endTimeStr = `${Math.floor(endTime).toString().padStart(2, '0')}:${Math.round((endTime % 1) * 60).toString().padStart(2, '0')}`;
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
          style={{ top: `${position}%`, transform: 'translateY(-50%)', left: '-60px', width: '50px' }}
        >
          {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
        </div>
      );
    }
    return labels;
  };

  const renderTimeSlots = () => {
    const slots = [];
    // Create 30-minute increments
    for (let hour = startHour; hour < endHour; hour += 0.5) {
      const position = getPositionFromTime(hour);
      const height = (0.5 / totalHours) * 100;
      const endTime = Math.min(hour + maxDurationHours, endHour);
      const available = isTimeSlotAvailable(hour, endTime);
      
      slots.push(
        <div
          key={hour}
          className={`absolute w-16 border border-gray-200 cursor-pointer transition-colors ${
            available ? 'hover:bg-blue-100' : 'bg-gray-100 cursor-not-allowed'
          }`}
          style={{
            top: `${position}%`,
            height: `${height}%`,
            left: '50%',
            transform: 'translateX(-50%)'
          }}
          onClick={() => available && handleTimeSlotClick(hour)}
        />
      );
    }
    return slots;
  };

  const renderBookedSlots = () => {
    return [...bookedSlots, ...maintenanceSlots].map((slot, index) => {
      const startHourNum = parseInt(slot.start.split(':')[0]) + parseInt(slot.start.split(':')[1]) / 60;
      const endHourNum = parseInt(slot.end.split(':')[0]) + parseInt(slot.end.split(':')[1]) / 60;
      
      const startPos = getPositionFromTime(startHourNum);
      const height = getPositionFromTime(endHourNum) - startPos;
      
      return (
        <div
          key={`booked-${index}`}
          className="absolute w-16 bg-red-200 border border-red-300 rounded flex items-center justify-center z-10"
          style={{
            top: `${startPos}%`,
            height: `${height}%`,
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        >
          <span className="text-xs text-red-700 px-1 text-center">
            {maintenanceSlots.includes(slot) ? 'Maint.' : 'Booked'}
          </span>
        </div>
      );
    });
  };

  // Format time to AM/PM
  const formatTimeToAmPm = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const renderSelectedSlot = () => {
    if (!selectedStartTime || !selectedEndTime) return null;
    
    const startHourNum = parseInt(selectedStartTime.split(':')[0]) + parseInt(selectedStartTime.split(':')[1]) / 60;
    const endHourNum = parseInt(selectedEndTime.split(':')[0]) + parseInt(selectedEndTime.split(':')[1]) / 60;
    
    const startPos = getPositionFromTime(startHourNum);
    const height = getPositionFromTime(endHourNum) - startPos;
    
    return (
      <div
        className="absolute w-20 bg-green-200 border-2 border-green-500 rounded flex items-center justify-center z-20"
        style={{
          top: `${startPos}%`,
          height: `${height}%`,
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        <span className="text-xs text-green-700 px-1 text-center font-medium">
          {formatTimeToAmPm(selectedStartTime)} - {formatTimeToAmPm(selectedEndTime)}
        </span>
      </div>
    );
  };

  const maxDurationText = () => {
    const hours = Math.floor(maxDurationMinutes / 60);
    const minutes = maxDurationMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minutes`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium">
          Select your time slot (maximum {maxDurationText()})
        </div>
        {(selectedStartTime && selectedEndTime) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
      
      <div className="relative flex">
        {/* Time labels */}
        <div className="relative w-16 h-96">
          {renderTimeLabels()}
        </div>
        
        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative w-24 h-96 bg-gray-100 border rounded ml-4"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Time slots */}
          {renderTimeSlots()}
          
          {/* Booked slots */}
          {renderBookedSlots()}
          
          {/* Selected slot (persistent) */}
          {renderSelectedSlot()}
          
          {/* Current selection (while dragging) */}
          {isDragging && dragStart !== null && dragEnd !== null && (
            <div
              className={`absolute w-20 border-2 rounded flex items-center justify-center z-30 ${
                isTimeSlotAvailable(dragStart, dragEnd) 
                  ? 'bg-green-200 border-green-500' 
                  : 'bg-red-200 border-red-500'
              }`}
              style={{
                top: `${getPositionFromTime(dragStart)}%`,
                height: `${getPositionFromTime(dragEnd) - getPositionFromTime(dragStart)}%`,
                left: '50%',
                transform: 'translateX(-50%)'
              }}
            >
              <span className="text-xs px-1 text-center">
                {(() => {
                  const startH = Math.floor(dragStart);
                  const startM = Math.round((dragStart % 1) * 60);
                  const endH = Math.floor(dragEnd);
                  const endM = Math.round((dragEnd % 1) * 60);
                  const startPeriod = startH >= 12 ? 'PM' : 'AM';
                  const endPeriod = endH >= 12 ? 'PM' : 'AM';
                  const startDisplay = startH % 12 === 0 ? 12 : startH % 12;
                  const endDisplay = endH % 12 === 0 ? 12 : endH % 12;
                  return `${startDisplay}:${startM.toString().padStart(2, '0')} ${startPeriod} - ${endDisplay}:${endM.toString().padStart(2, '0')} ${endPeriod}`;
                })()}
              </span>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground mt-2 ml-4 max-w-48">
          Click on a time slot or drag to select your preferred time. Each slot is 30 minutes. Red areas are unavailable. Green shows your current selection.
        </div>
      </div>
    </div>
  );
};

export default TimeSelector;
