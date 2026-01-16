import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, Clock, Calendar, FileText, Sun, Sunrise, Moon, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MatchPrefs {
  lookingToPlay: boolean;
  matchTypes: string[];
  preferredTimes: string[];
  preferredDays: string[];
  notes: string;
}

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
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' }
];

interface MatchFinderSectionProps {
  onHasChanges?: (hasChanges: boolean) => void;
}

const MatchFinderSection: React.FC<MatchFinderSectionProps> = ({ onHasChanges }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [initialPrefs, setInitialPrefs] = useState<MatchPrefs | null>(null);
  const [preferences, setPreferences] = useState<MatchPrefs>({
    lookingToPlay: false,
    matchTypes: [],
    preferredTimes: [],
    preferredDays: [],
    notes: ''
  });

  useEffect(() => {
    if (currentUser) {
      loadPreferences();
    }
  }, [currentUser]);

  // Track changes
  useEffect(() => {
    if (initialPrefs && onHasChanges) {
      const hasChanges = JSON.stringify(preferences) !== JSON.stringify(initialPrefs);
      onHasChanges(hasChanges);
    }
  }, [preferences, initialPrefs, onHasChanges]);

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
        const prefs: MatchPrefs = {
          lookingToPlay: data.looking_to_play,
          matchTypes: data.match_types || [],
          preferredTimes: data.preferred_times || [],
          preferredDays: data.preferred_days || [],
          notes: data.notes || ''
        };
        setPreferences(prefs);
        setInitialPrefs(prefs);
      } else {
        setInitialPrefs({ ...preferences });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
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

  // Auto-save individual preference changes
  const savePreferences = async (newPrefs: MatchPrefs) => {
    if (!currentUser) return;

    try {
      await supabase
        .from('match_preferences')
        .upsert({
          user_id: currentUser.id,
          looking_to_play: newPrefs.lookingToPlay,
          match_types: newPrefs.matchTypes,
          preferred_times: newPrefs.preferredTimes,
          preferred_days: newPrefs.preferredDays,
          notes: newPrefs.notes
        }, {
          onConflict: 'user_id'
        });
      
      setInitialPrefs(newPrefs);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Debounced save for notes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialPrefs && preferences.notes !== initialPrefs.notes) {
        savePreferences(preferences);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [preferences.notes]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Match Finder Preferences</CardTitle>
        <CardDescription>Configure your availability and play preferences to help others find you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Looking to Play Toggle */}
        <div className="flex items-center justify-between py-4 px-4 bg-muted/30 rounded-xl">
          <div>
            <Label className="text-base font-semibold">Looking to Play</Label>
            <p className="text-sm text-muted-foreground">
              Make yourself discoverable to other players in the community
            </p>
          </div>
          <Switch
            checked={preferences.lookingToPlay}
            onCheckedChange={(checked) => {
              const newPrefs = { ...preferences, lookingToPlay: checked };
              setPreferences(newPrefs);
              savePreferences(newPrefs);
            }}
            className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
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
                  onClick={() => {
                    handleArrayToggle(preferences.matchTypes, option.value, 'matchTypes');
                    const newPrefs = {
                      ...preferences,
                      matchTypes: preferences.matchTypes.includes(option.value)
                        ? preferences.matchTypes.filter(t => t !== option.value)
                        : [...preferences.matchTypes, option.value]
                    };
                    savePreferences(newPrefs);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/30 text-foreground bg-background"
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
                  onClick={() => {
                    handleArrayToggle(preferences.preferredTimes, option.value, 'preferredTimes');
                    const newPrefs = {
                      ...preferences,
                      preferredTimes: preferences.preferredTimes.includes(option.value)
                        ? preferences.preferredTimes.filter(t => t !== option.value)
                        : [...preferences.preferredTimes, option.value]
                    };
                    savePreferences(newPrefs);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/30 bg-background"
                  )}
                >
                  <div className="text-left">
                    <div className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>
                      {option.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{option.time}</div>
                  </div>
                  <option.icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
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
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((option) => {
              const isSelected = preferences.preferredDays.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    handleArrayToggle(preferences.preferredDays, option.value, 'preferredDays');
                    const newPrefs = {
                      ...preferences,
                      preferredDays: preferences.preferredDays.includes(option.value)
                        ? preferences.preferredDays.filter(d => d !== option.value)
                        : [...preferences.preferredDays, option.value]
                    };
                    savePreferences(newPrefs);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl border-2 transition-all duration-200 min-w-[60px]",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/30 text-foreground bg-background"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  <span>{option.label}</span>
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
            onChange={(e) => setPreferences(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="e.g., Available most Sundays. Prefer doubles. I have my own equipment."
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">Changes are saved automatically</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchFinderSection;
