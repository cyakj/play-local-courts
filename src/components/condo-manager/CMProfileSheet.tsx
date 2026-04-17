import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, ArrowLeft, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface CMProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities: Array<{ id: string; name: string; totalUnits: number }>;
}

type SubScreen = null | 'account' | 'notifications' | 'help';

const CMProfileSheet: React.FC<CMProfileSheetProps> = ({ open, onOpenChange, communities }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Account form state
  const [editName, setEditName] = useState(currentUser?.fullName || '');
  const [editEmail, setEditEmail] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    new_maintenance: true,
    report_status: true,
    member_applications: true,
    booking_confirmations: true,
    health_alerts: true,
    survey_responses: true,
    community_events: true,
  });

  const initials = currentUser?.fullName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    logout();
    navigate('/login');
  };

  const handleSaveAccount = async () => {
    if (!currentUser?.id) return;
    setSavingAccount(true);
    const { error } = await supabase.from('profiles').update({ full_name: editName.trim() }).eq('id', currentUser.id);
    if (error) toast.error('Failed to save');
    else toast.success('Account updated');
    setSavingAccount(false);
  };

  const openSub = (s: SubScreen) => {
    if (s === 'account') {
      setEditName(currentUser?.fullName || '');
      // Fetch email
      supabase.auth.getUser().then(({ data }) => setEditEmail(data?.user?.email || ''));
    }
    setSubScreen(s);
  };

  const handleClose = () => {
    setSubScreen(null);
    setShowSignOutConfirm(false);
    onOpenChange(false);
  };

  const renderSubHeader = (title: string) => (
    <div className="flex items-center gap-3 mb-6">
      <div
        onClick={() => setSubScreen(null)}
        className="w-9 h-9 rounded-full bg-[#F9FAFB] flex items-center justify-center cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 text-[#0F1F3D]" />
      </div>
      <div className="text-[17px] font-extrabold text-[#0F1F3D]">{title}</div>
    </div>
  );

  // Sub-screens
  if (subScreen === 'account') {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="rounded-t-[20px] p-6 max-h-[85vh] overflow-y-auto border-0 [&>button]:hidden">
          <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-5" />
          {renderSubHeader('My Account')}
          <div className="space-y-4">
            <div>
              <label className="text-[13px] font-bold text-[#0F1F3D] mb-1.5 block">Full Name</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[#E5E7EB] text-sm"
              />
            </div>
            <div>
              <label className="text-[13px] font-bold text-[#0F1F3D] mb-1.5 block">Email</label>
              <input
                value={editEmail}
                disabled
                className="w-full px-3 py-2.5 rounded-[10px] border border-[#E5E7EB] text-sm bg-[#F9FAFB] text-[#9CA3AF]"
              />
            </div>
            <button className="w-full text-left px-3 py-2.5 rounded-[10px] border border-[#E5E7EB] text-sm font-semibold text-[#0F1F3D]">
              Change Password
            </button>
            <button
              onClick={!savingAccount ? handleSaveAccount : undefined}
              className={`w-full bg-[#0F1F3D] text-white rounded-[10px] py-3 text-sm font-bold min-h-[44px] ${savingAccount ? 'opacity-50' : ''}`}
            >
              {savingAccount ? 'Saving...' : 'Save'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (subScreen === 'notifications') {
    const items = [
      { key: 'new_maintenance', label: 'New maintenance reports' },
      { key: 'report_status', label: 'Report status changes' },
      { key: 'member_applications', label: 'Member applications' },
      { key: 'booking_confirmations', label: 'Booking confirmations' },
      { key: 'health_alerts', label: 'Health score alerts' },
      { key: 'survey_responses', label: 'Survey responses' },
      { key: 'community_events', label: 'Community events' },
    ] as const;

    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="rounded-t-[20px] p-6 max-h-[85vh] overflow-y-auto border-0 [&>button]:hidden">
          <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-5" />
          {renderSubHeader('Notification Preferences')}
          <div className="space-y-1">
            {items.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-3">
                <span className="text-[14px] font-semibold text-[#0F1F3D]">{label}</span>
                <Switch
                  checked={notifPrefs[key]}
                  onCheckedChange={v => setNotifPrefs(p => ({ ...p, [key]: v }))}
                  className="data-[state=checked]:bg-[#00D4FF]"
                />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }


  if (subScreen === 'help') {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="rounded-t-[20px] p-6 max-h-[85vh] overflow-y-auto border-0 [&>button]:hidden">
          <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-5" />
          {renderSubHeader('Help & Support')}
          <div className="space-y-4">
            <a
              href="mailto:support@playlocalcourts.com"
              className="block w-full text-center bg-[#F9FAFB] rounded-[10px] py-3 text-sm font-bold text-[#0F1F3D]"
            >
              📧 Email Support
            </a>
            <div className="rounded-[10px] bg-[#F9FAFB] p-4">
              <div className="text-[14px] font-bold text-[#0F1F3D] mb-2">FAQ</div>
              <div className="text-[13px] text-[#9CA3AF]">Coming soon — frequently asked questions will appear here.</div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Main menu
  const menuItems: Array<{ icon: string; label: string; sub: SubScreen }> = [
    { icon: '👤', label: 'My Account', sub: 'account' },
    { icon: '🔔', label: 'Notification Preferences', sub: 'notifications' },
    { icon: '❓', label: 'Help & Support', sub: 'help' },
  ];

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-[20px] p-6 max-h-[85vh] overflow-y-auto border-0 [&>button]:hidden">
        <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-5" />

        {/* Profile header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#0D2137] border-2 border-[#00D4FF] flex items-center justify-center mb-3">
            <span className="text-white text-[18px] font-extrabold">{initials}</span>
          </div>
          <div className="text-[18px] font-extrabold text-[#0F1F3D]">{currentUser?.fullName || 'User'}</div>
          <div className="text-[13px] text-[#9CA3AF] mt-0.5">{editEmail || 'Loading...'}</div>
          <div className="text-[12px] text-[#00D4FF] font-bold mt-0.5">Property Manager</div>
        </div>

        {/* Menu items */}
        <div className="space-y-1">
          {menuItems.map(item => (
            <div
              key={item.label}
              onClick={() => openSub(item.sub)}
              className="flex items-center justify-between py-3.5 px-1 cursor-pointer rounded-lg hover:bg-[#F9FAFB] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{item.icon}</span>
                <span className="text-[15px] font-semibold text-[#0F1F3D]">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#E5E7EB] my-3" />

        {/* Sign Out */}
        {!showSignOutConfirm ? (
          <div
            onClick={() => setShowSignOutConfirm(true)}
            className="text-center py-3 cursor-pointer"
          >
            <span className="text-[15px] font-bold text-[#EF4444]">Sign Out</span>
          </div>
        ) : (
          <div className="text-center space-y-3 py-2">
            <div className="text-[14px] font-semibold text-[#0F1F3D]">Are you sure you want to sign out?</div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 py-2.5 rounded-[10px] bg-[#F9FAFB] text-[14px] font-semibold text-[#9CA3AF]"
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
      </SheetContent>
    </Sheet>
  );
};

export default CMProfileSheet;
