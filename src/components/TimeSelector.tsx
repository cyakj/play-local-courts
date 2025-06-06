
import React, { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';

interface TimeSelectorProps {
  selectedDate: Date;
  onTimeSelect: (startTime: string, endTime: string) => void;
  isDoubles: boolean;
  bookedSlots: Array<{ start: string; end: string }>;
  maintenanceSlots: Array<{ start: string; end: string }>;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({
  selectedDate,
  onTimeSelect,
  isDoubles,
  bookedSlots,
  maintenanceSlots
}) => {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Operating hours: 6 AM to 10 PM (16 hours)
  const startHour = 6;
  const endHour = 22;
  const totalHours = endHour - startHour;

  const getTimeFromPosition = useCallback((position: number): number => {
    if (!timelineRef.current) return startHour;
    const rect = timelineRef.current.getBoundingClientRect();
    const relativePosition = Math.max(0, Math.min(1, position / rect.width));
    return startHour + (relativePosition * totalHours);
  }, []);

  const getPositionFromTime = useCallback((hour: number): number => {
    return ((hour - startHour) / totalHours) * 100;
  }, []);

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
    
    const x = e.clientX - rect.left;
    const time = getTimeFromPosition(x);
    
    setDragStart(time);
    setDragEnd(time + 1); // Minimum 1 hour
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStart === null) return;
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const time = getTimeFromPosition(x);
    
    if (time > dragStart) {
      const minDuration = 1; // 1 hour minimum
      const newEnd = Math.max(time, dragStart + minDuration);
      setDragEnd(Math.min(newEnd, endHour));
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

  const renderTimeLabels = () => {
    const labels = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const position = getPositionFromTime(hour);
      labels.push(
        <div
          key={hour}
          className="absolute text-xs text-muted-foreground"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
        </div>
      );
    }
    return labels;
  };

  const renderBookedSlots = () => {
    return [...bookedSlots, ...maintenanceSlots].map((slot, index) => {
      const startHourNum = parseInt(slot.start.split(':')[0]) + parseInt(slot.start.split(':')[1]) / 60;
      const endHourNum = parseInt(slot.end.split(':')[0]) + parseInt(slot.end.split(':')[1]) / 60;
      
      const startPos = getPositionFromTime(startHourNum);
      const width = getPositionFromTime(endHourNum) - startPos;
      
      return (
        <div
          key={`booked-${index}`}
          className="absolute h-6 bg-red-200 border border-red-300 rounded"
          style={{
            left: `${startPos}%`,
            width: `${width}%`,
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          <span className="text-xs text-red-700 px-1">
            {maintenanceSlots.includes(slot) ? 'Maintenance' : 'Booked'}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">
        Select your time slot by clicking and dragging (minimum 1 hour)
      </div>
      
      <div className="relative">
        {/* Time labels */}
        <div className="relative h-6 mb-2">
          {renderTimeLabels()}
        </div>
        
        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative h-12 bg-gray-100 border rounded cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Booked slots */}
          {renderBookedSlots()}
          
          {/* Current selection */}
          {isDragging && dragStart !== null && dragEnd !== null && (
            <div
              className={`absolute h-8 border-2 rounded ${
                isTimeSlotAvailable(dragStart, dragEnd) 
                  ? 'bg-green-200 border-green-500' 
                  : 'bg-red-200 border-red-500'
              }`}
              style={{
                left: `${getPositionFromTime(dragStart)}%`,
                width: `${getPositionFromTime(dragEnd) - getPositionFromTime(dragStart)}%`,
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            >
              <span className="text-xs px-1">
                {`${Math.floor(dragStart).toString().padStart(2, '0')}:${Math.round((dragStart % 1) * 60).toString().padStart(2, '0')} - ${Math.floor(dragEnd).toString().padStart(2, '0')}:${Math.round((dragEnd % 1) * 60).toString().padStart(2, '0')}`}
              </span>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          Click and drag to select your preferred time slot. Red areas are unavailable.
        </div>
      </div>
    </div>
  );
};

export default TimeSelector;
