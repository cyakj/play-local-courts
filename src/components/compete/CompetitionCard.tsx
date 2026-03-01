import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Star, Target, Lock, MapPin, Building2, Calendar } from 'lucide-react';
import { Competition } from './types';
import { Progress } from '@/components/ui/progress';
import { format, isFuture, differenceInDays } from 'date-fns';

interface CompetitionCardProps {
  competition: Competition;
  onSelect: (c: Competition) => void;
  teamCount?: number;
  creatorName?: string;
  creatorRole?: string;
  actionLabel?: string;
  showCreator?: boolean;
}

const formatLabel = (f: string) => {
  switch (f) {
    case 'singles': return 'Singles';
    case 'doubles': return 'Doubles';
    case 'mixed_doubles': return 'Mixed Doubles';
    default: return f;
  }
};

const formatIcon = (f: string) => {
  switch (f) {
    case 'singles': return <Users className="h-5 w-5" />;
    case 'doubles': return <Target className="h-5 w-5" />;
    case 'mixed_doubles': return <Star className="h-5 w-5" />;
    default: return <Trophy className="h-5 w-5" />;
  }
};

const iconBg = (f: string) => {
  switch (f) {
    case 'singles': return 'bg-compete-light text-compete';
    case 'doubles': return 'bg-orange-100 text-orange-600';
    case 'mixed_doubles': return 'bg-emerald-100 text-emerald-600';
    default: return 'bg-compete-light text-compete';
  }
};

const CompetitionCard = ({ competition, onSelect, teamCount = 0, creatorName, creatorRole, actionLabel, showCreator }: CompetitionCardProps) => {
  const maxTeams = competition.max_teams || 20;
  const fillPct = Math.min((teamCount / maxTeams) * 100, 100);

  const statusBadge = () => {
    if (competition.status === 'active') return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>;
    if (competition.status === 'completed') return <Badge variant="secondary" className="text-xs">Completed</Badge>;
    if (competition.registration_deadline && isFuture(new Date(competition.registration_deadline))) {
      const days = differenceInDays(new Date(competition.registration_deadline), new Date());
      return <Badge variant="outline" className="bg-white text-xs">{days}d left</Badge>;
    }
    return <Badge variant="outline" className="bg-white text-xs">Open</Badge>;
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card" onClick={() => onSelect(competition)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          {competition.image_url ? (
            <div className="h-12 w-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
              <img src={competition.image_url} alt={competition.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg(competition.format)}`}>
              {formatIcon(competition.format)}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {competition.hoa_only && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <Building2 className="h-3 w-3 mr-0.5" /> Community
              </Badge>
            )}
            {competition.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            {statusBadge()}
          </div>
        </div>

        <h3 className="font-bold text-base mb-1 text-foreground line-clamp-1">{competition.name}</h3>
        
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <span>{formatLabel(competition.format)}</span>
          {competition.min_ntrp && competition.max_ntrp && (
            <span>· NTRP {competition.min_ntrp}-{competition.max_ntrp}</span>
          )}
        </div>

        {showCreator && creatorName && (
          <div className="text-xs text-muted-foreground mb-1">
            by {creatorName} {creatorRole && <span className="text-compete">({creatorRole})</span>}
          </div>
        )}

        {competition.city && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MapPin className="h-3 w-3" /> {competition.city}
          </div>
        )}

        {competition.registration_deadline && competition.status === 'setup' && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <Calendar className="h-3 w-3" /> Reg. by {format(new Date(competition.registration_deadline), 'MMM d')}
          </div>
        )}

        <Progress value={fillPct} className="h-1.5 mb-2 bg-muted" />
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-muted-foreground">{teamCount}/{maxTeams} Players</span>
          {fillPct >= 80 && <span className="text-primary font-medium italic">Almost Full!</span>}
        </div>

        <Button
          onClick={(e) => { e.stopPropagation(); onSelect(competition); }}
          className="w-full min-h-[44px] bg-compete hover:bg-compete/90 text-compete-foreground"
          size="sm"
        >
          {actionLabel || (competition.status === 'active' ? 'View' : 'View')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CompetitionCard;
