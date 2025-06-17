
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface MatchPrefs {
  lookingToPlay: boolean;
  matchTypes: string[];
  preferredTimes: string[];
  preferredDays: string[];
  notes: string;
}

const MatchPreferences = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<MatchPrefs>({
    lookingToPlay: false,
    matchTypes: [],
    preferredTimes: [],
    preferredDays: [],
    notes: ''
  });

  const matchTypeOptions = [
    { value: 'singles', label: 'Singles' },
    { value: 'doubles', label: 'Doubles' },
    { value: 'mixed_doubles', label: 'Mixed Doubles' }
  ];

  const timeOptions = [
    { value: 'morning', label: 'Morning (6AM - 12PM)' },
    { value: 'afternoon', label: 'Afternoon (12PM - 6PM)' },
    { value: 'evening', label: 'Evening (6PM - 10PM)' }
  ];

  const dayOptions = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  useEffect(() => {
    if (currentUser) {
      loadPreferences();
    }
  }, [currentUser]);

  const loadPreferences = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('match_preferences')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences({
          lookingToPlay: data.looking_to_play,
          matchTypes: data.match_types || [],
          preferredTimes: data.preferred_times || [],
          preferredDays: data.preferred_days || [],
          notes: data.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load match preferences",
        variant: "destructive"
      });
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('match_preferences')
        .upsert({
          user_id: currentUser.id,
          looking_to_play: preferences.lookingToPlay,
          match_types: preferences.matchTypes,
          preferred_times: preferences.preferredTimes,
          preferred_days: preferences.preferredDays,
          notes: preferences.notes
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Match preferences updated successfully"
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleArrayToggle = (array: string[], value: string, field: keyof MatchPrefs) => {
    const newArray = array.includes(value)
      ? array.filter(item => item !== value)
      : [...array, value];
    
    setPreferences(prev => ({ ...prev, [field]: newArray }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Match Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Looking to Play Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="lookingToPlay" className="text-base font-medium">
                Looking to Play
              </Label>
              <p className="text-sm text-muted-foreground">
                Make yourself discoverable to other players
              </p>
            </div>
            <Switch
              id="lookingToPlay"
              checked={preferences.lookingToPlay}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, lookingToPlay: checked }))
              }
            />
          </div>

          {preferences.lookingToPlay && (
            <>
              {/* Match Types */}
              <div>
                <Label className="text-base font-medium mb-3 block">Match Types</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {matchTypeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`match-${option.value}`}
                        checked={preferences.matchTypes.includes(option.value)}
                        onCheckedChange={() => 
                          handleArrayToggle(preferences.matchTypes, option.value, 'matchTypes')
                        }
                      />
                      <Label htmlFor={`match-${option.value}`}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferred Times */}
              <div>
                <Label className="text-base font-medium mb-3 block">Preferred Times</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {timeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`time-${option.value}`}
                        checked={preferences.preferredTimes.includes(option.value)}
                        onCheckedChange={() => 
                          handleArrayToggle(preferences.preferredTimes, option.value, 'preferredTimes')
                        }
                      />
                      <Label htmlFor={`time-${option.value}`}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferred Days */}
              <div>
                <Label className="text-base font-medium mb-3 block">Preferred Days</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dayOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${option.value}`}
                        checked={preferences.preferredDays.includes(option.value)}
                        onCheckedChange={() => 
                          handleArrayToggle(preferences.preferredDays, option.value, 'preferredDays')
                        }
                      />
                      <Label htmlFor={`day-${option.value}`}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="text-base font-medium">
                  Additional Notes
                </Label>
                <Textarea
                  id="notes"
                  value={preferences.notes}
                  onChange={(e) => setPreferences(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g., Available most Sundays. Prefer doubles."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};

export default MatchPreferences;
