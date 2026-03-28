import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Building2, Plus, Mail, Lock, Bell, Globe, HelpCircle, MessageSquare, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CMSettings = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const initials = currentUser?.fullName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      await logout();
      navigate('/login');
    } catch {
      toast({ title: 'Error', description: 'Failed to sign out', variant: 'destructive' });
    }
  };

  const menuSections = [
    {
      title: 'PORTFOLIO',
      items: [
        { icon: Building2, label: 'My Communities', desc: 'Manage your HOA portfolio', path: '/cm' },
        { icon: Plus, label: 'Add Community', desc: 'Connect a new HOA', path: '/join-community' },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { icon: Mail, label: 'Account Details', desc: 'Email, phone, password', path: '/cm/settings/account' },
        { icon: Lock, label: 'Security', desc: 'Two-factor auth, active sessions', path: '/cm/settings/security' },
      ],
    },
    {
      title: 'PREFERENCES',
      items: [
        { icon: Bell, label: 'Notifications', desc: 'Manage alert preferences', path: '/cm/settings/notifications' },
        { icon: Globe, label: 'Language & Region', desc: 'Language, timezone, date format', path: '/cm/settings/language' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: HelpCircle, label: 'Help & Support', desc: 'FAQ, contact, policies', path: '/cm/settings/help' },
        { icon: MessageSquare, label: 'Send Feedback', desc: 'Report a bug or suggest a feature', path: '/cm/settings/feedback' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Settings</span>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
          <div className="flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0"
              style={{ background: '#0A1628', border: '2px solid #00B4D8' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-extrabold text-[16px] text-[#1A1A2E] truncate">
                {currentUser?.fullName || 'Your Name'}
              </h2>
              <p className="text-[13px] text-[#9CA3AF] mt-0.5">Property Manager</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/cm/settings/edit-profile')}
            className="w-full mt-3.5 py-2.5 rounded-[10px] text-xs font-bold text-white"
            style={{ background: '#00B4D8' }}
          >
            Edit Profile
          </button>
        </div>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <div key={section.title}>
            <p className="text-[11px] font-bold text-[#9CA3AF] tracking-wider px-1 mb-2">
              {section.title}
            </p>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
              {section.items.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#F0F4F8] transition-colors min-h-[52px] ${
                      idx < section.items.length - 1 ? 'border-b border-[#E5E7EB]' : ''
                    }`}
                  >
                    <div className="p-2 bg-[#F0F4F8] rounded-lg">
                      <Icon className="h-4 w-4 text-[#4B5563]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm text-[#1A1A2E]">{item.label}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        {!showSignOutConfirm ? (
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full rounded-2xl p-4 text-center border border-red-100"
            style={{ background: '#FEF2F2' }}
          >
            <span className="text-[15px] font-bold text-[#EF4444]">Sign Out</span>
          </button>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] space-y-3">
            <p className="text-center text-[14px] font-semibold text-[#1A1A2E]">
              Are you sure you want to sign out?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 py-2.5 rounded-[10px] bg-[#F0F4F8] text-[14px] font-semibold text-[#9CA3AF]"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 py-2.5 rounded-[10px] bg-[#EF4444] text-white text-[14px] font-bold"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CMSettings;
