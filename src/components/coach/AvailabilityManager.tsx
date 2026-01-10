import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import WeeklyCalendarView from '@/components/WeeklyCalendarView';
import { startOfWeek } from 'date-fns';

interface AvailabilitySlot {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export default function AvailabilityManager() {
  const { currentUser } = useAuth();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [newSlot, setNewSlot] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00'
  });

  useEffect(() => {
    loadAvailability();
  }, [currentUser]);

  const loadAvailability = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('coach_availability')
        .select('*')
        .eq('coach_id', currentUser.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error('Error loading availability:', error);
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const addSlot = async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('coach_availability')
        .insert({
          coach_id: currentUser.id,
          day_of_week: newSlot.day_of_week,
          start_time: newSlot.start_time,
          end_time: newSlot.end_time
        });

      if (error) throw error;

      toast.success('Availability added successfully');
      setIsAdding(false);
      setNewSlot({
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00'
      });
      loadAvailability();
    } catch (error) {
      console.error('Error adding availability:', error);
      toast.error('Failed to add availability');
    }
  };

  const deleteSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('coach_availability')
        .delete()
        .eq('id', slotId);

      if (error) throw error;

      toast.success('Availability removed');
      loadAvailability();
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to remove availability');
    }
  };

  // Format time to AM/PM
  const formatTimeToAmPm = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Convert slots to weekly calendar format - white slots on grey background
  const weeklyTimeSlots = useMemo(() => {
    return slots.map(slot => ({
      id: slot.id,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      title: `${formatTimeToAmPm(slot.start_time)} - ${formatTimeToAmPm(slot.end_time)}`,
      subtitle: DAYS_OF_WEEK[slot.day_of_week],
      color: 'bg-white text-foreground border border-border shadow-sm'
    }));
  }, [slots]);

  const handleSlotClick = (slot: any) => {
    if (confirm(`Remove availability slot on ${DAYS_OF_WEEK[slot.dayOfWeek]} from ${formatTimeToAmPm(slot.startTime)} to ${formatTimeToAmPm(slot.endTime)}?`)) {
      deleteSlot(slot.id);
    }
  };

  if (loading) {
    return <div className="p-6">Loading availability...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Manage Your Availability</h3>
          <p className="text-sm text-muted-foreground">
            Set your weekly availability for students to book lessons
          </p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Time Slot
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Availability</CardTitle>
            <CardDescription>Select day and time range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Day of Week</Label>
              <select
                className="w-full mt-1 p-2 border rounded-md bg-background"
                value={newSlot.day_of_week}
                onChange={(e) => setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })}
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <option key={index} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-md bg-background"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                >
                  {Array.from({ length: 26 }, (_, i) => {
                    const hour = Math.floor(i / 2) + 7;
                    const minutes = (i % 2) * 30;
                    const timeValue = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                    const period = hour >= 12 ? 'PM' : 'AM';
                    return (
                      <option key={timeValue} value={timeValue}>
                        {displayHour}:{minutes.toString().padStart(2, '0')} {period}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <Label>End Time</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-md bg-background"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                >
                  {Array.from({ length: 26 }, (_, i) => {
                    const hour = Math.floor(i / 2) + 7;
                    const minutes = (i % 2) * 30;
                    const timeValue = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                    const period = hour >= 12 ? 'PM' : 'AM';
                    return (
                      <option key={timeValue} value={timeValue}>
                        {displayHour}:{minutes.toString().padStart(2, '0')} {period}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={addSlot} className="flex-1">
                Add Availability
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Calendar View */}
      <WeeklyCalendarView
        currentWeekStart={currentWeekStart}
        onWeekChange={setCurrentWeekStart}
        timeSlots={weeklyTimeSlots}
        startHour={7}
        endHour={20}
        onSlotClick={handleSlotClick}
        emptyMessage="No availability set. Click 'Add Time Slot' to get started."
        showNavigation={false}
        mode="availability"
      />

      <p className="text-sm text-muted-foreground text-center">
        Click on a slot to remove it
      </p>
    </div>
  );
}
