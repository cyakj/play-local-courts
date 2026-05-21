import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertCircle, 
  Trophy, 
  GraduationCap, 
  Wrench,
  X,
  ChevronRight
} from 'lucide-react';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';

interface Alert {
  id: string;
  type: 'match_invite' | 'lesson_pending' | 'maintenance_update';
  message: string;
  link: string;
  icon: React.ReactNode;
  color: string;
}

export const ActionRequiredAlerts = () => {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser) {
      loadAlerts();
    }
  }, [currentUser]);

  const loadAlerts = async () => {
    if (!currentUser) return;
    
    try {
      const alertList: Alert[] = [];

      // Check for pending match invites (only if tennis features enabled)
      if (TENNIS_FEATURES_ENABLED) {
        const { data: matchRequests, count: matchCount } = await supabase
          .from('match_requests')
          .select('id', { count: 'exact' })
          .eq('opponent_id', currentUser.id)
          .eq('status', 'pending');

        if (matchCount && matchCount > 0) {
          alertList.push({
            id: 'match_invites',
            type: 'match_invite',
            message: `You have ${matchCount} pending match invite${matchCount > 1 ? 's' : ''}`,
            link: '/',
            icon: <Trophy className="h-4 w-4" />,
            color: 'text-compete bg-compete/10 border-compete/20'
          });
        }

        // Check for lesson requests awaiting coach response
        const { data: lessonRequests, count: lessonCount } = await supabase
          .from('lesson_requests')
          .select('id', { count: 'exact' })
          .eq('player_id', currentUser.id)
          .eq('status', 'pending');

        if (lessonCount && lessonCount > 0) {
          alertList.push({
            id: 'lesson_pending',
            type: 'lesson_pending',
            message: `${lessonCount} lesson request${lessonCount > 1 ? 's' : ''} awaiting coach response`,
            link: '/my-home?tab=lessons',
            icon: <GraduationCap className="h-4 w-4" />,
            color: 'text-green-600 bg-green-50 border-green-200'
          });
        }
      }

      // Check for maintenance updates (for HOA users) - always active
      const { data: maintenanceUpdates, count: maintenanceCount } = await supabase
        .from('maintenance_reports')
        .select('id', { count: 'exact' })
        .eq('reporter_id', currentUser.id)
        .in('status', ['in_progress', 'resolved'])
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (maintenanceCount && maintenanceCount > 0) {
        alertList.push({
          id: 'maintenance_update',
          type: 'maintenance_update',
          message: `${maintenanceCount} maintenance issue${maintenanceCount > 1 ? 's' : ''} updated`,
          link: '/reserve-court',
          icon: <Wrench className="h-4 w-4" />,
          color: 'text-orange-600 bg-orange-50 border-orange-200'
        });
      }

      setAlerts(alertList);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAlerts.map(alert => (
        <Card
          key={alert.id}
          className={`p-3 border ${alert.color} flex items-center gap-3`}
        >
          <div className="flex-shrink-0">
            {alert.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{alert.message}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link to={alert.link} className="flex items-center gap-1">
                View
                <ChevronRight className="h-3 w-3" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => dismissAlert(alert.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
