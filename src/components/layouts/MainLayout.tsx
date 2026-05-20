
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CoachNavbar from '../ui/CoachNavbar';
import BottomNavigation from './BottomNavigation';
import CoachBottomNavigation from './CoachBottomNavigation';
import GlobalAppHeader from './GlobalAppHeader';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';

const MainLayout = () => {
  const { currentUser, loading, isCoach } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading your community...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const showCoachLayout = TENNIS_FEATURES_ENABLED && isCoach;

  return (
    <div className="min-h-screen bg-background">
      {showCoachLayout && <CoachNavbar />}
      <main className={showCoachLayout ? "pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-6" : "pb-20"}>
        <Outlet />
      </main>
      {showCoachLayout ? <CoachBottomNavigation /> : <BottomNavigation />}
    </div>
  );
};

export default MainLayout;
