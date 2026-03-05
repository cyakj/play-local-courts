import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';
import { 
  FileText, 
  Trophy, 
  MessageSquare,
  ChevronRight,
  Users
} from 'lucide-react';

interface CommunityLink {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
}

export const CommunityLinksCard = () => {
  const { activeHOA, isHOAUser } = useActiveHOA();

  if (!isHOAUser) return null;

  const links: CommunityLink[] = [
    {
      icon: <FileText className="h-4 w-4" />,
      title: 'Rules & Guidelines',
      subtitle: 'POLICY UPDATED',
      to: '/amenity-rules'
    },
    {
      icon: <Trophy className="h-4 w-4" />,
      title: 'View All Ladders',
      subtitle: 'ACTIVE COMPETITIONS',
      to: '/leagues-ladders'
    }
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Community
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {links.map((link, idx) => (
          <Link
            key={idx}
            to={link.to}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
          >
            <div className="flex-shrink-0 text-muted-foreground">
              {link.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm group-hover:text-primary transition-colors">
                {link.title}
              </div>
              <div className="text-xs text-muted-foreground uppercase">
                {link.subtitle}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
};
