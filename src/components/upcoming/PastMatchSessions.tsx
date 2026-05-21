
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MatchSession {
  id: string;
  opponent: string;
  match_type?: string;
  date: string;
  time_start: string;
  location: string;
}

interface PastMatchSessionsProps {
  pastMatchSessions: MatchSession[];
}

const PastMatchSessions = ({ pastMatchSessions }: PastMatchSessionsProps) => {
  if (pastMatchSessions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past Match Play Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pastMatchSessions.slice(0, 5).map(session => {
            const sessionDate = new Date(session.date);
            
            return (
              <Card key={session.id} className="overflow-hidden bg-gray-50">
                <div className="flex flex-col sm:flex-row">
                  <div className="bg-gray-200 p-4 text-gray-700 sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                    <div className="text-lg font-medium">
                      {sessionDate.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-2xl font-bold">
                      {sessionDate.getDate()}
                    </div>
                  </div>
                  <div className="p-4 flex-1">
                    <div className="font-semibold">
                      {session.match_type?.replace('_', ' ')} Match
                    </div>
                    <div className="text-sm text-muted-foreground">
                      vs {session.opponent} • {session.time_start} • {session.location}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PastMatchSessions;
