
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../types';
import Navbar from '../ui/Navbar';
import PendingApprovalMessage from '../PendingApprovalMessage';

const MainLayout = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not logged in, redirect to login page
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If user status is pending or rejected, show appropriate message
  if (currentUser.status === UserStatus.PENDING) {
    return <PendingApprovalMessage />;
  }

  if (currentUser.status === UserStatus.REJECTED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Account Rejected</h1>
          <p className="text-gray-600 mb-4">
            Your account has been rejected by the HOA admin. Please contact your HOA administrator for more information.
          </p>
          <button 
            onClick={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="py-4 text-center bg-white border-t">
        <p className="text-sm text-gray-500">© 2025 HOA Court Reservation System</p>
      </footer>
    </div>
  );
};

export default MainLayout;
