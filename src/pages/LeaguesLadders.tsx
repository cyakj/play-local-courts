import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Competition } from '@/components/compete/types';
import CompetePlayerView from '@/components/compete/CompetePlayerView';
import CompeteAdminView from '@/components/compete/CompeteAdminView';
import CompetitionDetailPlayer from '@/components/compete/CompetitionDetailPlayer';
import ManageCompetition from '@/components/compete/ManageCompetition';
import CreateCompetitionWizard from '@/components/compete/CreateCompetitionWizard';

// Re-export Ladder type for backward compatibility
export type { Competition as Ladder } from '@/components/compete/types';

type ViewState =
  | { mode: 'list' }
  | { mode: 'view'; competition: Competition }
  | { mode: 'manage'; competition: Competition }
  | { mode: 'create' };

const LeaguesLadders = () => {
  const { isAdmin, isCoach } = useAuth();
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  const isAdminOrCoach = isAdmin || isCoach;

  if (view.mode === 'create') {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto p-4 sm:p-6">
          <CreateCompetitionWizard
            onBack={() => setView({ mode: 'list' })}
            onCreated={() => setView({ mode: 'list' })}
          />
        </div>
      </div>
    );
  }

  if (view.mode === 'view') {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto p-4 sm:p-6">
          <CompetitionDetailPlayer
            competition={view.competition}
            onBack={() => setView({ mode: 'list' })}
          />
        </div>
      </div>
    );
  }

  if (view.mode === 'manage') {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto p-4 sm:p-6">
          <ManageCompetition
            competition={view.competition}
            onBack={() => setView({ mode: 'list' })}
            onUpdated={() => setView({ mode: 'list' })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compete</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdminOrCoach
              ? 'Create and manage competitions, or browse available ones.'
              : 'Join ladders and round robins. Rise through the ranks.'}
          </p>
        </div>

        {isAdminOrCoach ? (
          <CompeteAdminView
            onSelectCompetition={(c) => setView({ mode: 'view', competition: c })}
            onManageCompetition={(c) => setView({ mode: 'manage', competition: c })}
            onCreateNew={() => setView({ mode: 'create' })}
          />
        ) : (
          <CompetePlayerView
            onSelectCompetition={(c) => setView({ mode: 'view', competition: c })}
          />
        )}
      </div>
    </div>
  );
};

export default LeaguesLadders;
