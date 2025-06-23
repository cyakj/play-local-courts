
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Trophy, Lock } from 'lucide-react';
import { Ladder } from '@/pages/LeaguesLadders';
import { format } from 'date-fns';

interface LadderListProps {
  ladders: Ladder[];
  onSelectLadder: (ladder: Ladder) => void;
  isLoading: boolean;
  emptyMessage: string;
}

const LadderList = ({ ladders, onSelectLadder, isLoading, emptyMessage }: LadderListProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (ladders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {ladders.map((ladder) => (
        <Card key={ladder.id} className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{ladder.name}</CardTitle>
              <div className="flex items-center gap-2">
                {ladder.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
                <Badge variant={
                  ladder.status === 'active' ? 'default' :
                  ladder.status === 'completed' ? 'secondary' : 'outline'
                }>
                  {ladder.status}
                </Badge>
              </div>
            </div>
            {ladder.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {ladder.description}
              </p>
            )}
          </CardHeader>
          
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="capitalize">{ladder.format}</span>
              </div>
              
              {ladder.start_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Starts {format(new Date(ladder.start_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              
              <Button 
                onClick={() => onSelectLadder(ladder)}
                className="w-full"
                variant={ladder.status === 'active' ? 'default' : 'outline'}
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default LadderList;
