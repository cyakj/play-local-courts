
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMatchType, formatTime12Hour } from '@/lib/textUtils';

interface MatchSession {
  id: string;
  opponent: string;
  match_type?: string;
  date: string;
  time_start: string;
  location: string;
}

interface UpcomingMatchSessionsProps {
  upcomingMatchSessions: MatchSession[];
}

const UpcomingMatchSessions = ({ upcomingMatchSessions }: UpcomingMatchSessionsProps) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upcoming Match Play Sessions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingMatchSessions.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No upcoming match sessions</p>
            <Button 
              variant="outline"
              onClick={() => navigate('/my-locker?tab=find-partner')}
            >
              Find Match
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingMatchSessions.slice(0, 5).map(session => {
              // Parse date as local date to avoid timezone issues
              const [year, month, day] = session.date.split('-').map(Number);
              const sessionDate = new Date(year, month - 1, day);
              
              return (
                <Card key={session.id} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="bg-green-600 text-white p-4 sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                      <div className="text-lg font-medium">
                        {sessionDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-bold">
                        {sessionDate.getDate()}
                      </div>
                    </div>
                    <div className="p-4 flex-1">
                      <div className="font-semibold">
                        {formatMatchType(session.match_type)} Match
                      </div>
                      <div className="text-sm text-muted-foreground">
                        vs {session.opponent} • {formatTime12Hour(session.time_start)} • {session.location}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingMatchSessions;
