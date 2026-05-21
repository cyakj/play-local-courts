
import React from 'react';
import { Outlet, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AuthLayout = () => {
  const { currentUser, loading } = useAuth();
  const [searchParams] = useSearchParams();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: '#F9FAFB' }}>
        <div
          className="w-12 h-12 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }}
        />
      </div>
    );
  }

  if (currentUser) {
    const redirect = searchParams.get('redirect');
    return <Navigate to={redirect || '/dashboard'} replace />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ background: '#F9FAFB', paddingTop: 56, paddingBottom: 48, paddingLeft: 20, paddingRight: 20 }}
    >
      <div className="w-full max-w-sm">
        {/* TenisX Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/images/TenisX_logo-removebg-preview.png"
            style={{ height: 72, width: 'auto', maxWidth: 200 }}
            alt="TenisX"
          />
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
