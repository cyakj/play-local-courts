import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PlayingPreferencesCardProps {
  userId: string;
}

const dayAbbrevs: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
};

const PlayingPreferencesCard: React.FC<PlayingPreferencesCardProps> = ({ userId }) => {
  const [prefs, setPrefs] = useState<{
    match_types: string[];
    preferred_days: string[];
    preferred_times: string[];
    looking_to_play: boolean;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('match_preferences')
        .select('match_types, preferred_days, preferred_times, looking_to_play')
        .eq('user_id', userId)
        .single();
      if (data) setPrefs(data);
    };
    load();
  }, [userId]);

  if (!prefs || (!prefs.match_types.length && !prefs.preferred_days.length && !prefs.preferred_times.length)) {
    return null;
  }

  const formatTypes = prefs.match_types.map(t => {
    if (t === 'singles') return 'Singles';
    if (t === 'doubles') return 'Doubles';
    if (t === 'hitting_session') return 'Hitting Session';
    return t;
  });

  const formatDays = prefs.preferred_days.map(d => dayAbbrevs[d] || d);
  const formatTimes = prefs.preferred_times.map(t => t.charAt(0).toUpperCase() + t.slice(1));

  const summaryParts = [
    formatTypes.join(' & '),
    formatDays.join('/'),
    formatTimes.join('/')
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Playing Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary line */}
        <p className="text-sm text-muted-foreground mb-3">{summaryParts.join(' · ')}</p>
        
        <div className="space-y-3">
          {formatTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-1">
                {formatTypes.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}
          {formatDays.length > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-1">
                {formatDays.map(d => (
                  <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}
          {formatTimes.length > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-1">
                {formatTimes.map(t => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {prefs.looking_to_play && (
          <Badge className="mt-3 bg-green-100 text-green-700 text-xs">Currently Looking to Play</Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayingPreferencesCard;
