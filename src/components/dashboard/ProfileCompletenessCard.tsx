import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  CheckCircle2,
  Circle,
  ChevronRight
} from 'lucide-react';

interface ProfileItem {
  id: string;
  label: string;
  completed: boolean;
}

export const ProfileCompletenessCard = () => {
  const { currentUser, isCoach } = useAuth();
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      checkProfileCompleteness();
    }
  }, [currentUser, isCoach]);

  const checkProfileCompleteness = async () => {
    if (!currentUser) return;
    
    try {
      const profileItems: ProfileItem[] = [];

      // Get profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, ntrp_rating, bio, zip_code, full_name')
        .eq('id', currentUser.id)
        .single();

      if (profile) {
        profileItems.push({
          id: 'name',
          label: 'Full name added',
          completed: !!profile.full_name
        });

        profileItems.push({
          id: 'photo',
          label: 'Profile photo',
          completed: !!profile.avatar_url
        });

        profileItems.push({
          id: 'rating',
          label: 'Skill rating set',
          completed: !!profile.ntrp_rating
        });

        profileItems.push({
          id: 'location',
          label: 'Location added',
          completed: !!profile.zip_code
        });
      }

      // For coaches, check availability
      if (isCoach) {
        const { count: availCount } = await supabase
          .from('coach_availability')
          .select('id', { count: 'exact' })
          .eq('coach_id', currentUser.id);

        profileItems.push({
          id: 'availability',
          label: 'Availability set',
          completed: (availCount || 0) > 0
        });
      }

      setItems(profileItems);
    } catch (error) {
      console.error('Error checking profile completeness:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Don't show if profile is complete
  if (!loading && percentage === 100) return null;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 bg-muted rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profile
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            {percentage}% complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Progress value={percentage} className="h-2 mb-4" />
        
        <div className="space-y-2 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={item.completed ? 'text-muted-foreground line-through' : ''}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/my-locker?tab=profile" className="flex items-center gap-1">
            Complete Profile
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
