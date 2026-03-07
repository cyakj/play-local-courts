import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CondoManagerBottomNav from './CondoManagerBottomNav';

const CondoManagerLayout = () => {
  const { currentUser, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin mx-auto" />
          <p className="text-cm-text-mid font-medium">Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isCondoManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-cm-app-bg">
      <main className="pb-20">
        <Outlet />
      </main>
      <CondoManagerBottomNav />
    </div>
  );
};

export default CondoManagerLayout;
