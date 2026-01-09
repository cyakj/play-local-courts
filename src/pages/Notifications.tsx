import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Calendar, 
  MessageSquare, 
  Trophy, 
  GraduationCap,
  Clock,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import { formatTime12Hour } from '@/lib/textUtils';

interface Notification {
  id: string;
  type: 'lesson' | 'match' | 'reservation' | 'message' | 'ladder';
  title: string;
  description: string;
  date: string;
  time?: string;
  link?: string;
  isNew?: boolean;
}

const Notifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    if (!currentUser) return;

    try {
      const allNotifications: Notification[] = [];
      const today = new Date().toISOString().split('T')[0];

      // Fetch upcoming lessons
      const { data: lessons } = await supabase
        .from('lesson_requests')
        .select('id, preferred_date, preferred_time_start, sport, lesson_type, status')
        .eq('player_id', currentUser.id)
        .in('status', ['accepted', 'confirmed', 'pending'])
        .gte('preferred_date', today)
        .order('preferred_date', { ascending: true })
        .limit(5);

      if (lessons) {
        lessons.forEach(lesson => {
          allNotifications.push({
            id: `lesson-${lesson.id}`,
            type: 'lesson',
            title: lesson.status === 'pending' ? 'Pending Lesson Request' : 'Upcoming Lesson',
            description: `${lesson.lesson_type} ${lesson.sport} lesson on ${new Date(lesson.preferred_date + 'T00:00:00').toLocaleDateString()}`,
            date: lesson.preferred_date,
            time: lesson.preferred_time_start,
            link: '/my-locker?tab=lessons',
            isNew: lesson.status === 'pending'
          });
        });
      }

      // Fetch pending match requests
      const { data: matchRequests } = await supabase
        .from('match_requests')
        .select('id, date, time_start, match_type, status, challenger:profiles!match_requests_challenger_id_fkey(full_name)')
        .eq('opponent_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (matchRequests) {
        matchRequests.forEach(request => {
          allNotifications.push({
            id: `match-request-${request.id}`,
            type: 'match',
            title: 'Match Request',
            description: `${request.challenger?.full_name || 'Someone'} wants to play ${request.match_type || 'a match'}`,
            date: request.date || 'TBD',
            time: request.time_start,
            link: '/',
            isNew: true
          });
        });
      }

      // Fetch accepted matches coming up
      const { data: acceptedMatches } = await supabase
        .from('match_requests')
        .select('id, date, time_start, match_type, location')
        .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
        .eq('status', 'accepted')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(5);

      if (acceptedMatches) {
        acceptedMatches.forEach(match => {
          allNotifications.push({
            id: `match-${match.id}`,
            type: 'match',
            title: 'Upcoming Match',
            description: `${match.match_type || 'Match'} at ${match.location || 'TBD'}`,
            date: match.date,
            time: match.time_start,
            link: '/upcoming'
          });
        });
      }

      // Fetch unread messages
      const { data: messages } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('receiver_id', currentUser.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messages) {
        // Fetch sender names
        const senderIds = [...new Set(messages.map(m => m.sender_id))];
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds);

        messages.forEach(msg => {
          const sender = senderProfiles?.find(p => p.id === msg.sender_id);
          allNotifications.push({
            id: `message-${msg.id}`,
            type: 'message',
            title: 'New Message',
            description: `${sender?.full_name || 'Someone'}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`,
            date: msg.created_at.split('T')[0],
            link: '/messages',
            isNew: true
          });
        });
      }

      // Sort by date descending, new items first
      allNotifications.sort((a, b) => {
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'lesson':
        return <GraduationCap className="h-5 w-5 text-green-600" />;
      case 'match':
        return <Trophy className="h-5 w-5 text-orange-600" />;
      case 'reservation':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-purple-600" />;
      case 'ladder':
        return <Trophy className="h-5 w-5 text-compete" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Stay updated on your activities and messages
        </p>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">All caught up!</h3>
            <p className="text-muted-foreground text-sm">
              You have no new notifications
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={notification.isNew ? 'border-primary/50 bg-primary/5' : ''}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-muted">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{notification.title}</h4>
                      {notification.isNew && (
                        <Badge variant="default" className="text-xs">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(notification.date + 'T00:00:00').toLocaleDateString()}
                      </span>
                      {notification.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime12Hour(notification.time)}
                        </span>
                      )}
                    </div>
                  </div>
                  {notification.link && (
                    <Link to={notification.link}>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
