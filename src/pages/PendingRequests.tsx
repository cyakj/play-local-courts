import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { UserStatus } from '../types';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { ArrowLeft, UserCheck, UserX, Users } from 'lucide-react';

const PendingRequests = () => {
  const { currentUser, isAdmin } = useAuth();
  const { pendingUsers, approveUser, rejectUser, refreshData } = useData();
  const navigate = useNavigate();

  useRealtimeSubscription({
    table: 'community_join_requests',
    event: '*',
    onChange: () => refreshData(),
    enabled: isAdmin,
  });

  useRealtimeSubscription({
    table: 'profiles',
    event: 'UPDATE',
    onChange: () => refreshData(),
    enabled: isAdmin,
  });

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    if (currentUser && isAdmin) refreshData();
  }, [currentUser, isAdmin, refreshData]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-8 relative overflow-visible">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/admin')} className="text-white active:scale-95 transition-transform">
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Admin
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight">
          Pending Requests
        </h1>
        <p className="text-cyan-200 mt-2 leading-relaxed" style={{ fontSize: '15px', opacity: 0.85 }}>
          Review and approve users wanting to join your HOA.
        </p>

        {pendingUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full w-fit" style={{ backgroundColor: 'rgba(249,112,102,0.2)' }}>
            <Users className="h-3.5 w-3.5 text-white" />
            <span className="text-[12px] font-bold text-white">{pendingUsers.length} Awaiting</span>
          </div>
        )}

        <div className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }} />
      </div>

      <div className="px-5 pt-8 space-y-3">
        {pendingUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <UserCheck className="h-12 w-12 mx-auto mb-3" style={{ color: '#00D4FF' }} />
            <div className="text-[15px] font-bold mb-1" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>All Clear</div>
            <div className="text-[13px]" style={{ color: '#8892A4' }}>No pending member requests right now.</div>
          </div>
        ) : (
          pendingUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-2xl p-5 border border-gray-100"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              {/* Name + pending pill */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-[16px] font-extrabold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                  {user.fullName}
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#FFF5F5', color: '#C0392B', border: '1px solid #F97066' }}
                >
                  Pending
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-semibold w-16 flex-shrink-0" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Email</span>
                  <span className="text-[13px] truncate" style={{ color: '#0F1F3D' }}>{user.email}</span>
                </div>
                {user.phoneNumber && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase font-semibold w-16 flex-shrink-0" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Phone</span>
                    <span className="text-[13px]" style={{ color: '#0F1F3D' }}>{user.phoneNumber}</span>
                  </div>
                )}
                {user.dateOfBirth && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase font-semibold w-16 flex-shrink-0" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>DOB</span>
                    <span className="text-[13px]" style={{ color: '#0F1F3D' }}>{new Date(user.dateOfBirth).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-semibold w-16 flex-shrink-0" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Applied</span>
                  <span className="text-[13px]" style={{ color: '#0F1F3D' }}>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={async () => { await rejectUser(user.id); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold min-h-[44px]"
                  style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
                >
                  <UserX className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={async () => { await approveUser(user.id); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold text-white min-h-[44px]"
                  style={{ backgroundColor: '#00D4FF' }}
                >
                  <UserCheck className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PendingRequests;
