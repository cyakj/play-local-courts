
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Users, Clock, Calendar, FileText, Sun, Sunrise, Moon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [hasChanges, setHasChanges] = useState(false);
  const [preferences, setPreferences] = useState<MatchPrefs>({
    lookingToPlay: false,
    matchTypes: [],
    preferredTimes: [],
    preferredDays: [],
    notes: ''
  });

  const matchTypeOptions = [
    { value: 'singles', label: 'Singles', icon: Users },
    { value: 'doubles', label: 'Doubles', icon: Users },
    { value: 'mixed_doubles', label: 'Mixed', icon: Users },
    { value: 'hitting_session', label: 'Hitting', icon: Users }
  ];

  const timeOptions = [
    { value: 'morning', label: 'Morning', time: '6AM - 12PM', icon: Sunrise },
    { value: 'afternoon', label: 'Afternoon', time: '12PM - 6PM', icon: Sun },
    { value: 'evening', label: 'Evening', time: '6PM - 10PM', icon: Moon }
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
      setHasChanges(false);
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
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Match preferences updated successfully"
      });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: `Failed to save preferences: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    loadPreferences();
    setHasChanges(false);
  };

  const handleArrayToggle = (array: string[], value: string, field: keyof MatchPrefs) => {
    const newArray = array.includes(value)
      ? array.filter(item => item !== value)
      : [...array, value];
    
    setPreferences(prev => ({ ...prev, [field]: newArray }));
    setHasChanges(true);
  };

  const updatePreference = (field: keyof MatchPrefs, value: any) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Match Finder</h1>
          <p className="text-muted-foreground">Configure your availability and play preferences.</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-6 space-y-8">
          {/* Looking to Play Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Looking to Play</Label>
              <p className="text-sm text-muted-foreground">
                Make yourself discoverable to other players in the community
              </p>
            </div>
            <Switch
              checked={preferences.lookingToPlay}
              onCheckedChange={(checked) => updatePreference('lookingToPlay', checked)}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {/* Match Types */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Users className="h-4 w-4" />
              Match Types
            </div>
            <div className="flex flex-wrap gap-3">
              {matchTypeOptions.map((option) => {
                const isSelected = preferences.matchTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleArrayToggle(preferences.matchTypes, option.value, 'matchTypes')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground/30 text-foreground"
                    )}
                  >
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Times */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-4 w-4" />
              Preferred Times
            </div>
            <div className="flex flex-wrap gap-3">
              {timeOptions.map((option) => {
                const isSelected = preferences.preferredTimes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleArrayToggle(preferences.preferredTimes, option.value, 'preferredTimes')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="text-left">
                      <div className={cn(
                        "font-medium",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{option.time}</div>
                    </div>
                    <option.icon className={cn(
                      "h-4 w-4 ml-2",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Days */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Calendar className="h-4 w-4" />
              Preferred Days
            </div>
            <div className="flex flex-wrap gap-3">
              {dayOptions.map((option) => {
                const isSelected = preferences.preferredDays.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleArrayToggle(preferences.preferredDays, option.value, 'preferredDays')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground/30 text-foreground"
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                    <span className={!isSelected ? "ml-6" : ""}>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <FileText className="h-4 w-4" />
              Additional Notes
            </div>
            <Textarea
              value={preferences.notes}
              onChange={(e) => updatePreference('notes', e.target.value)}
              placeholder="e.g., Available most Sundays. Prefer doubles. I have my own equipment."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          onClick={handleDiscard}
          disabled={!hasChanges || loading}
        >
          Discard Changes
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};

export default MatchPreferences;
