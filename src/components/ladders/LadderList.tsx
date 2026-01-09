import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Star, Target, Lock } from 'lucide-react';
import { Ladder } from '@/pages/LeaguesLadders';
import { differenceInDays, format, isPast, isFuture } from 'date-fns';
import { Progress } from '@/components/ui/progress';

interface LadderListProps {
  ladders: Ladder[];
  onSelectLadder: (ladder: Ladder) => void;
  isLoading: boolean;
  emptyMessage: string;
  teamCounts?: Record<string, number>;
}

const getFormatIcon = (format: string) => {
  switch (format) {
    case 'singles':
      return <Users className="h-5 w-5" />;
    case 'doubles':
      return <Target className="h-5 w-5" />;
    case 'mixed_doubles':
      return <Star className="h-5 w-5" />;
    default:
      return <Trophy className="h-5 w-5" />;
  }
};

const getFormatLabel = (format: string) => {
  switch (format) {
    case 'singles': return 'Singles';
    case 'doubles': return 'Doubles';
    case 'mixed_doubles': return 'Mixed Doubles';
    default: return format;
  }
};

const getIconBgColor = (format: string) => {
  switch (format) {
    case 'singles':
      return 'bg-compete-light text-compete';
    case 'doubles':
      return 'bg-orange-100 text-orange-600';
    case 'mixed_doubles':
      return 'bg-emerald-100 text-emerald-600';
    default:
      return 'bg-compete-light text-compete';
  }
};

const getStatusBadge = (ladder: Ladder) => {
  if (ladder.status === 'active') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-0 font-medium">
        Active Now
      </Badge>
    );
  }
  
  if (ladder.status === 'completed') {
    return (
      <Badge variant="secondary" className="font-medium">
        Completed
      </Badge>
    );
  }
  
  // Setup status - show time until start
  if (ladder.start_date) {
    const startDate = new Date(ladder.start_date);
    if (isFuture(startDate)) {
      const daysUntil = differenceInDays(startDate, new Date());
      return (
        <Badge variant="outline" className="bg-white font-medium">
          Starts in {daysUntil}d
        </Badge>
      );
    }
  }
  
  return (
    <Badge variant="outline" className="bg-white font-medium">
      Open
    </Badge>
  );
};

const LadderList = ({ ladders, onSelectLadder, isLoading, emptyMessage, teamCounts = {} }: LadderListProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 bg-muted rounded-xl"></div>
                <div className="h-6 w-20 bg-muted rounded-full"></div>
              </div>
              <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2 mb-6"></div>
              <div className="h-2 bg-muted rounded-full w-full mb-3"></div>
              <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
              <div className="h-11 bg-muted rounded-lg w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (ladders.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-16 w-16 bg-compete-light rounded-2xl flex items-center justify-center mb-4">
            <Trophy className="h-8 w-8 text-compete" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {ladders.map((ladder) => {
        const teamCount = teamCounts[ladder.id] || 0;
        const maxTeams = 20; // Default max teams
        const fillPercentage = Math.min((teamCount / maxTeams) * 100, 100);
        const isAlmostFull = fillPercentage >= 80;
        
        return (
          <Card 
            key={ladder.id} 
            className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white"
            onClick={() => onSelectLadder(ladder)}
          >
            <CardContent className="p-6">
              {/* Header with icon and status */}
              <div className="flex items-start justify-between mb-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${getIconBgColor(ladder.format)}`}>
                  {getFormatIcon(ladder.format)}
                </div>
                <div className="flex items-center gap-2">
                  {ladder.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
                  {getStatusBadge(ladder)}
                </div>
              </div>
              
              {/* Title and format */}
              <h3 className="font-bold text-lg mb-1 text-foreground">
                {ladder.name}
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
                <Star className="h-3.5 w-3.5" />
                <span>{getFormatLabel(ladder.format)}</span>
                {ladder.min_ntrp && ladder.max_ntrp && (
                  <span className="ml-1">• NTRP {ladder.min_ntrp}-{ladder.max_ntrp}</span>
                )}
              </div>
              
              {/* Progress bar */}
              <Progress 
                value={fillPercentage} 
                className="h-2 mb-3 bg-muted"
              />
              
              {/* Participants count */}
              <div className="flex items-center justify-between text-sm mb-5">
                <span className="text-muted-foreground">
                  {teamCount} / {maxTeams} Participants
                </span>
                <span className={isAlmostFull ? 'text-primary font-medium italic' : 'text-muted-foreground'}>
                  {isAlmostFull ? 'Almost Full!' : `${Math.round(fillPercentage)}% Full`}
                </span>
              </div>
              
              {/* Action button */}
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLadder(ladder);
                }}
                className="w-full bg-compete hover:bg-compete/90 text-compete-foreground"
              >
                {ladder.status === 'active' ? 'View Ladder' : 'Join Ladder'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default LadderList;