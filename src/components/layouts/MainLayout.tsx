
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../ui/Navbar';
import CoachNavbar from '../ui/CoachNavbar';
import BottomNavigation from './BottomNavigation';
import CoachBottomNavigation from './CoachBottomNavigation';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';

const MainLayout = () => {
  const { currentUser, loading, isCoach } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-blue-600 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-gray-600 font-medium">Loading your community...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // When tennis features are disabled, always use the player layout (no coach portal)
  const showCoachLayout = TENNIS_FEATURES_ENABLED && isCoach;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-blue-50/30 to-purple-50/30">
      {showCoachLayout ? <CoachNavbar /> : <Navbar />}
      <main className="pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="py-6">
          <Outlet />
        </div>
      </main>
      {showCoachLayout ? <CoachBottomNavigation /> : <BottomNavigation />}
    </div>
  );
};

export default MainLayout;
