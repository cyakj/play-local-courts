import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, User, Shield, Bell, LifeBuoy, LogOut, Trash2, Lock, ChevronRight } from 'lucide-react';
import { useSettingsForm } from '@/hooks/useSettingsForm';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AccountSection from '@/components/settings/AccountSection';
import PrivacySection from '@/components/settings/PrivacySection';
import NotificationsSection from '@/components/settings/NotificationsSection';
import HelpSupportSection from '@/components/settings/HelpSupportSection';
import SaveChangesFooter from '@/components/settings/SaveChangesFooter';
import { ActiveCommunitySelector } from '@/components/community/ActiveCommunitySelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SettingsView = 'main' | 'account' | 'privacy' | 'notifications' | 'help';

const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { activeHOA, memberships, pendingMemberships } = useActiveHOA();
  const { toast } = useToast();
  const [view, setView] = useState<SettingsView>('main');

  const {
    loading,
    saving,
    hasChanges,
    isCoach,
    profile,
    setProfile,
    privacy,
    setPrivacy,
    saveChanges,
    discardChanges,
  } = useSettingsForm();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to log out', variant: 'destructive' });
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Password Reset Email Sent', description: 'Check your email for the reset link' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send reset email', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Sub-views
  if (view !== 'main') {
    const renderSubView = () => {
      switch (view) {
        case 'account':
          return <AccountSection profile={profile} setProfile={setProfile} />;
        case 'privacy':
          return <PrivacySection privacy={privacy} setPrivacy={setPrivacy} />;
        case 'notifications':
          return <NotificationsSection />;
        case 'help':
          return <HelpSupportSection />;
      }
    };

    const viewTitles: Record<string, string> = {
      account: 'Account Details',
      privacy: 'Privacy & Security',
      notifications: 'Notifications',
      help: 'Help & Support',
    };

    return (
      <div className="min-h-screen pb-24">
        <Button
          variant="ghost"
          className="mb-4 h-11 -ml-2"
          onClick={() => setView('main')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {viewTitles[view]}
        </Button>
        {renderSubView()}
        <SaveChangesFooter
          hasChanges={hasChanges}
          saving={saving}
          onSave={saveChanges}
          onDiscard={discardChanges}
        />
      </div>
    );
  }

  // Main settings view
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Navy Header */}
      <div className="navy-gradient text-white px-5 pt-[50px] pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Settings</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

      {/* Profile Section */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0" style={{ background: '#0A1628', border: '2px solid #00B4D8' }}>
              {profile.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-extrabold text-[17px] truncate">{profile.fullName || 'Your Name'}</h2>
              {activeHOA && <p className="text-xs font-semibold mt-0.5" style={{ color: '#00B4D8' }}>{activeHOA.hoaName}</p>}
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/edit-profile')}
            className="w-full mt-3.5 py-2 rounded-[10px] text-xs font-bold text-white"
            style={{ background: '#00B4D8' }}
          >
            Edit Profile
          </button>
        </CardContent>
      </Card>

      {/* My Communities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Communities</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {memberships.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border",
                m.hoaId === activeHOA?.hoaId ? "border-primary/30 bg-primary/5" : "border-border"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{m.hoaName}</p>
                  {m.hoaId === activeHOA?.hoaId && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
              </div>
            </div>
          ))}
          {pendingMemberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-yellow-200 bg-yellow-50/50">
              <div>
                <p className="font-medium text-sm">{m.hoaName}</p>
                <Badge variant="outline" className="text-[10px] text-yellow-700 border-yellow-300">Pending</Badge>
              </div>
            </div>
          ))}
          {memberships.length > 1 && (
            <div className="pt-2">
              <ActiveCommunitySelector onAddCommunity={() => navigate('/my-home?tab=community')} />
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full h-11 text-sm text-primary"
            onClick={() => navigate('/my-home?tab=community')}
          >
            + Join or apply to a new community
          </Button>
        </CardContent>
      </Card>

      {/* Settings Links */}
      <div className="space-y-1">
        {[
          { id: 'notifications' as const, icon: Bell, label: 'Notifications', desc: 'Manage alert preferences' },
          { id: 'privacy' as const, icon: Shield, label: 'Privacy', desc: 'Profile visibility settings' },
          { id: 'account' as const, icon: Lock, label: 'Account', desc: 'Email, phone, password' },
          { id: 'help' as const, icon: LifeBuoy, label: 'Help & Support', desc: 'FAQ, terms, contact' },
        ].map(({ id, icon: Icon, label, desc }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-muted/50 transition-colors min-h-[44px]"
          >
            <div className="p-2 bg-muted rounded-lg">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <Separator />

      {/* Sign Out */}
      <div
        className="rounded-2xl p-4 text-center cursor-pointer"
        style={{ background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.13)' }}
        onClick={handleLogout}
      >
        <span className="text-[15px] font-bold" style={{ color: '#EF4444' }}>Sign Out</span>
      </div>

      <SaveChangesFooter
        hasChanges={hasChanges}
        saving={saving}
        onSave={saveChanges}
        onDiscard={discardChanges}
      />
      </div>
    </div>
  );
};

export default Settings;
