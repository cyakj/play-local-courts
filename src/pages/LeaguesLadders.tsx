import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Competition } from '@/components/compete/types';
import CompetePlayerView from '@/components/compete/CompetePlayerView';
import CompeteManageView from '@/components/compete/CompeteManageView';
import CompetitionDetailPlayer from '@/components/compete/CompetitionDetailPlayer';
import ManageCompetition from '@/components/compete/ManageCompetition';
import CreateCompetitionWizard from '@/components/compete/CreateCompetitionWizard';
import { supabase } from '@/integrations/supabase/client';

export type { Competition as Ladder } from '@/components/compete/types';

type ViewState =
  | { mode: 'list' }
  | { mode: 'view'; competition: Competition; defaultTab?: string }
  | { mode: 'manage'; competition: Competition }
  | { mode: 'create' };

const LeaguesLadders = () => {
  const { isAdmin, isCoach } = useAuth();
  const location = useLocation();
  const [view, setView] = useState<ViewState>({ mode: 'list' });
  const [activeTab, setActiveTab] = useState<'compete' | 'manage'>('compete');

  // Handle deep-link navigation from invitation messages
  useEffect(() => {
    const state = location.state as { openCompetitionId?: string; defaultTab?: string } | null;
    if (state?.openCompetitionId) {
      const loadAndOpen = async () => {
        const { data } = await supabase
          .from('ladders')
          .select('*')
          .eq('id', state.openCompetitionId!)
          .single();
        if (data) {
          setView({ mode: 'view', competition: data as unknown as Competition, defaultTab: state.defaultTab });
        }
      };
      loadAndOpen();
      // Clear state so back navigation doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const isAdminOrCoach = isAdmin || isCoach;

  if (view.mode === 'create') {
    return (
      <div className="min-h-screen bg-muted/30 pb-24">
        <div className="container mx-auto p-4 sm:p-6">
          <CreateCompetitionWizard
            onBack={() => setView({ mode: 'list' })}
            onCreated={() => { setView({ mode: 'list' }); setActiveTab('manage'); }}
          />
        </div>
      </div>
    );
  }

  if (view.mode === 'view') {
    return (
      <div className="min-h-screen bg-muted/30 pb-24">
        <div className="container mx-auto p-4 sm:p-6">
          <CompetitionDetailPlayer
            competition={view.competition}
            onBack={() => setView({ mode: 'list' })}
            defaultTab={view.defaultTab}
          />
        </div>
      </div>
    );
  }

  if (view.mode === 'manage') {
    return (
      <div className="min-h-screen bg-muted/30 pb-24">
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
    <div className="min-h-screen bg-muted/30 pb-24">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compete</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Join ladders and round robins. Rise through the ranks.
          </p>
        </div>

        {/* Top-level tab switcher for admins/coaches */}
        {isAdminOrCoach && (
          <div className="sticky top-0 z-10 bg-muted/30 backdrop-blur-sm pb-4">
            <div className="inline-flex items-center bg-card rounded-xl p-1 shadow-sm border border-border/50">
              <button
                onClick={() => setActiveTab('compete')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  activeTab === 'compete'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Compete
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  activeTab === 'manage'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Manage
              </button>
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'compete' ? (
          <CompetePlayerView
            onSelectCompetition={(c) => setView({ mode: 'view', competition: c })}
          />
        ) : (
          <CompeteManageView
            onSelectCompetition={(c) => setView({ mode: 'view', competition: c })}
            onManageCompetition={(c) => setView({ mode: 'manage', competition: c })}
            onCreateNew={() => setView({ mode: 'create' })}
          />
        )}
      </div>
    </div>
  );
};

export default LeaguesLadders;
