import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
                className="w-full mt-1 p-2 border rounded-md"
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
                <Input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                />
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

      <div className="space-y-4">
        {DAYS_OF_WEEK.map((day, dayIndex) => {
          const daySlotsData = slots.filter(s => s.day_of_week === dayIndex);
          
          return (
            <Card key={dayIndex}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {day}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {daySlotsData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No availability set</p>
                ) : (
                  <div className="space-y-2">
                    {daySlotsData.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-accent/50"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {slot.start_time} - {slot.end_time}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSlot(slot.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
