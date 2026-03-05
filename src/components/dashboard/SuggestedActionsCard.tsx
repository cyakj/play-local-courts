import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Lightbulb, 
  Users, 
  Trophy, 
  Clock,
  Camera,
  Target,
  ChevronRight
} from 'lucide-react';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';

interface Suggestion {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  priority: number;
}

export const SuggestedActionsCard = () => {
  const { currentUser, isCoach } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (currentUser) {
      generateSuggestions();
    }
  }, [currentUser, isCoach]);

  const generateSuggestions = async () => {
    if (!currentUser) return;
    
    const suggestionList: Suggestion[] = [];

    try {
      // Check profile completeness
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, ntrp_rating, bio, zip_code')
        .eq('id', currentUser.id)
        .single();

      if (profile) {
        if (!profile.avatar_url) {
          suggestionList.push({
            id: 'add_photo',
            icon: <Camera className="h-4 w-4 text-blue-600" />,
            title: 'Add a profile photo',
            description: 'Help others recognize you',
            link: '/my-home?tab=profile',
            priority: 1
          });
        }

        if (TENNIS_FEATURES_ENABLED && !profile.ntrp_rating) {
          suggestionList.push({
            id: 'add_rating',
            icon: <Target className="h-4 w-4 text-green-600" />,
            title: 'Set your skill rating',
            description: 'Find better matched opponents',
            link: '/my-locker?tab=profile',
            priority: 2
          });
        }
      }

      if (TENNIS_FEATURES_ENABLED) {
        // Check if user is in any ladder
        const { count: ladderCount } = await supabase
          .from('ladder_teams')
          .select('id', { count: 'exact' })
          .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`);

        if (!ladderCount || ladderCount === 0) {
          suggestionList.push({
            id: 'join_ladder',
            icon: <Trophy className="h-4 w-4 text-compete" />,
            title: 'Join a ladder',
            description: 'Compete and track your progress',
            link: '/leagues-ladders',
            priority: 3
          });
        }

        // Check match preferences
        const { data: prefs } = await supabase
          .from('match_preferences')
          .select('id')
          .eq('user_id', currentUser.id)
          .single();

        if (!prefs) {
          suggestionList.push({
            id: 'set_preferences',
            icon: <Users className="h-4 w-4 text-primary" />,
            title: 'Find players near you',
            description: 'Set your match preferences',
            link: '/my-locker?tab=find-partner',
            priority: 4
          });
        }

        // For coaches, check availability
        if (isCoach) {
          const { count: availCount } = await supabase
            .from('coach_availability')
            .select('id', { count: 'exact' })
            .eq('coach_id', currentUser.id);

          if (!availCount || availCount === 0) {
            suggestionList.push({
              id: 'set_availability',
              icon: <Clock className="h-4 w-4 text-orange-600" />,
              title: 'Set your availability',
              description: 'Let players book lessons',
              link: '/coach-schedule',
              priority: 1
            });
          }
        }
      }

      // Sort by priority and take top 3
      setSuggestions(suggestionList.sort((a, b) => a.priority - b.priority).slice(0, 3));
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Suggested for You
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {suggestions.map(suggestion => (
            <Link
              key={suggestion.id}
              to={suggestion.link}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
            >
              <div className="flex-shrink-0 p-2 bg-background rounded-lg">
                {suggestion.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{suggestion.title}</div>
                <div className="text-xs text-muted-foreground">{suggestion.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
