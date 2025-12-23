import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, startOfWeek, format, isSameDay, parseISO, getDay } from 'date-fns';

interface TimeSlot {
  id: string;
  date?: string;
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  startTime: string;
  endTime: string;
  title?: string;
  subtitle?: string;
  color?: string;
  type?: string;
}

interface WeeklyCalendarViewProps {
  title?: string;
  currentWeekStart: Date;
  onWeekChange: (newWeekStart: Date) => void;
  timeSlots: TimeSlot[];
  startHour?: number; // Default 7
  endHour?: number;   // Default 20
  onSlotClick?: (slot: TimeSlot) => void;
  emptyMessage?: string;
  showNavigation?: boolean;
  mode?: 'events' | 'availability'; // 'events' uses date, 'availability' uses dayOfWeek
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklyCalendarView({
  title,
  currentWeekStart,
  onWeekChange,
  timeSlots,
  startHour = 7,
  endHour = 20,
  onSlotClick,
  emptyMessage = 'No events this week',
  showNavigation = true,
  mode = 'events'
}: WeeklyCalendarViewProps) {
  // Generate time labels (30-min increments)
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      labels.push(`${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? 'AM' : 'PM'}`);
      if (hour < endHour) {
        labels.push(`${hour % 12 === 0 ? 12 : hour % 12}:30 ${hour < 12 ? 'AM' : 'PM'}`);
      }
    }
    return labels;
  }, [startHour, endHour]);

  // Calculate week dates
  const weekDates = useMemo(() => {
    const start = startOfWeek(currentWeekStart, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentWeekStart]);

  // Navigate week
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = addDays(currentWeekStart, direction === 'next' ? 7 : -7);
    onWeekChange(startOfWeek(newStart, { weekStartsOn: 0 }));
  };

  // Parse time to get position
  const getTimePosition = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + (minutes || 0);
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const range = endMinutes - startMinutes;
    return Math.max(0, Math.min(100, ((totalMinutes - startMinutes) / range) * 100));
  };

  // Get height for slot
  const getSlotHeight = (startTime: string, endTime: string): number => {
    const startPos = getTimePosition(startTime);
    const endPos = getTimePosition(endTime);
    return Math.max(5, endPos - startPos);
  };

  // Get slots for a specific day
  const getSlotsForDay = (dayIndex: number, date: Date) => {
    return timeSlots.filter(slot => {
      if (mode === 'availability') {
        return slot.dayOfWeek === dayIndex;
      }
      return slot.date && isSameDay(parseISO(slot.date), date);
    });
  };

  // Calculate total slots per row (30 min increments)
  const rowCount = (endHour - startHour) * 2;
  const rowHeight = 40; // pixels per 30-min slot

  return (
    <Card className="overflow-hidden">
      {(title || showNavigation) && (
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            {title && <span>{title}</span>}
            {showNavigation && (
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[180px] text-center text-sm">
                  {format(weekDates[0], 'MMM d')} - {format(weekDates[6], 'MMM d, yyyy')}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
      )}
      
      {/* Slot for legend - will be passed as children */}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="flex border-b bg-muted/30">
              <div className="w-[80px] box-border p-2 text-center text-sm font-medium text-muted-foreground border-r shrink-0">
                Time
              </div>
              <div className="grid grid-cols-7 flex-1">
                {weekDates.map((date, index) => (
                  <div key={index} className="p-2 text-center border-r last:border-r-0">
                    <div className="text-sm font-medium">{DAYS[index]}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(date, 'M/d')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time grid */}
            <div className="relative" style={{ height: rowCount * rowHeight }}>
              {/* Time labels column */}
              <div className="absolute left-0 top-0 w-[80px] box-border h-full border-r bg-background z-10">
                {timeLabels.map((label, index) => (
                  <div
                    key={index}
                    className="absolute w-full text-xs text-muted-foreground px-2 flex items-center border-t border-border/50"
                    style={{ 
                      top: index * rowHeight, 
                      height: rowHeight
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              <div className="ml-[80px] grid grid-cols-7 h-full">
                {weekDates.map((date, dayIndex) => {
                  const daySlots = getSlotsForDay(dayIndex, date);
                  
                  return (
                    <div key={dayIndex} className="relative border-r last:border-r-0">
                      {/* Horizontal grid lines */}
                      {timeLabels.map((_, index) => (
                        <div
                          key={index}
                          className="absolute w-full border-t border-border/50"
                          style={{ top: index * rowHeight }}
                        />
                      ))}

                      {/* Event slots */}
                      {daySlots.map((slot) => {
                        const top = getTimePosition(slot.startTime);
                        const height = getSlotHeight(slot.startTime, slot.endTime);
                        const colorClass = slot.color || 'bg-primary';

                        return (
                          <div
                            key={slot.id}
                            className={`absolute left-1 right-1 rounded-md px-2 py-1 text-xs cursor-pointer overflow-hidden transition-opacity hover:opacity-90 ${colorClass} text-primary-foreground shadow-sm`}
                            style={{
                              top: `${top}%`,
                              height: `${height}%`,
                              minHeight: '24px'
                            }}
                            onClick={() => onSlotClick?.(slot)}
                          >
                            <div className="font-medium truncate">
                              {slot.title || `${slot.startTime} - ${slot.endTime}`}
                            </div>
                            {slot.subtitle && (
                              <div className="truncate opacity-80">{slot.subtitle}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Empty state */}
            {timeSlots.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <p className="text-muted-foreground text-sm">{emptyMessage}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
