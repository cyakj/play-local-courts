import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { useMode } from '@/contexts/ModeContext';
import {
  FileText,
  Trophy,
  ChevronRight,
  Users,
  Megaphone,
  Wrench,
} from 'lucide-react';

export const CommunityLinksCard = () => {
  const { isHOAUser } = useActiveHOA();
  const { triggerTennisComingSoon } = useMode();

  if (!isHOAUser) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Community
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {/* HOA links — fully functional */}
        <Link
          to="/amenity-rules"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
        >
          <div className="flex-shrink-0 text-muted-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm group-hover:text-primary transition-colors">
              Rules &amp; Guidelines
            </div>
            <div className="text-xs text-muted-foreground uppercase">Policy &amp; Documents</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          to="/upcoming"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
        >
          <div className="flex-shrink-0 text-muted-foreground">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm group-hover:text-primary transition-colors">
              Announcements
            </div>
            <div className="text-xs text-muted-foreground uppercase">Community updates</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* Tennis Ladders — Coming Soon */}
        <button
          onClick={triggerTennisComingSoon}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 transition-colors group"
        >
          <div className="flex-shrink-0 text-gray-300">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="font-medium text-sm text-muted-foreground group-hover:text-amber-600 transition-colors flex items-center gap-2">
              View All Ladders
              <span className="text-[10px] font-semibold text-amber-500 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-px leading-tight">
                Soon
              </span>
            </div>
            <div className="text-xs text-muted-foreground uppercase">Active competitions</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </button>
      </CardContent>
    </Card>
  );
};
