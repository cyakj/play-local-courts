import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { 
  Users, 
  Trophy, 
  FileText,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { subDays } from 'date-fns';

interface CommunityActivity {
  newPlayersThisWeek: number;
  upcomingLadders: number;
}

export const CommunitySignals = () => {
  const { activeHOA, isHOAUser } = useActiveHOA();
  const [activity, setActivity] = useState<CommunityActivity>({
    newPlayersThisWeek: 0,
    upcomingLadders: 0
  });

  useEffect(() => {
    if (isHOAUser && activeHOA) {
      loadCommunityActivity();
    }
  }, [isHOAUser, activeHOA]);

  const loadCommunityActivity = async () => {
    if (!activeHOA) return;
    
    try {
      const weekAgo = subDays(new Date(), 7).toISOString();

      // Count new members this week
      const { count: newMembers } = await supabase
        .from('hoa_memberships')
        .select('id', { count: 'exact' })
        .eq('hoa_id', activeHOA.hoaId)
        .eq('status', 'approved')
        .gte('created_at', weekAgo);

      // Count upcoming ladders
      // Count active ladders for this HOA
      const { count: ladders } = await supabase
        .from('ladders')
        .select('id', { count: 'exact' })
        .eq('hoa_id', activeHOA.hoaId)
        .eq('status', 'active');

      setActivity({
        newPlayersThisWeek: newMembers || 0,
        upcomingLadders: ladders || 0
      });
    } catch (error) {
      console.error('Error loading community activity:', error);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          Community
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Activity highlights */}
        {(activity.newPlayersThisWeek > 0 || activity.upcomingLadders > 0) && (
          <div className="space-y-2 mb-4">
            {activity.newPlayersThisWeek > 0 && (
              <div className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded-lg">
                <Users className="h-4 w-4 text-green-600" />
                <span>{activity.newPlayersThisWeek} new player{activity.newPlayersThisWeek > 1 ? 's' : ''} joined this week</span>
              </div>
            )}
            {activity.upcomingLadders > 0 && (
              <div className="flex items-center gap-2 text-sm p-2 bg-compete/10 rounded-lg">
                <Trophy className="h-4 w-4 text-compete" />
                <span>{activity.upcomingLadders} active ladder{activity.upcomingLadders > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Quick links */}
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link to="/amenity-rules" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Rules & Guidelines</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          </Button>
          
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link to="/leagues-ladders" className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span>View Ladders</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
