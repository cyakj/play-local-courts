import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useSettingsForm } from '@/hooks/useSettingsForm';
import SettingsNavigation, { SettingsSection } from '@/components/settings/SettingsNavigation';
import AccountSection from '@/components/settings/AccountSection';
import ProfileSection from '@/components/settings/ProfileSection';
import PrivacySection from '@/components/settings/PrivacySection';
import NotificationsSection from '@/components/settings/NotificationsSection';
import MatchFinderSection from '@/components/settings/MatchFinderSection';
import SaveChangesFooter from '@/components/settings/SaveChangesFooter';

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [matchFinderHasChanges, setMatchFinderHasChanges] = useState(false);

  const {
    loading,
    saving,
    hasChanges,
    isCoach,
    profile,
    setProfile,
    privacy,
    setPrivacy,
    coach,
    setCoach,
    saveChanges,
    discardChanges,
  } = useSettingsForm();

  const combinedHasChanges = hasChanges || matchFinderHasChanges;

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

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSection profile={profile} setProfile={setProfile} />;
      case 'profile':
        return (
          <ProfileSection
            profile={profile}
            setProfile={setProfile}
            coach={coach}
            setCoach={setCoach}
            isCoach={isCoach}
          />
        );
      case 'privacy':
        return <PrivacySection privacy={privacy} setPrivacy={setPrivacy} />;
      case 'notifications':
        return <NotificationsSection />;
      case 'match-finder':
        return <MatchFinderSection onHasChanges={setMatchFinderHasChanges} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        <SettingsNavigation
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isCoach={isCoach}
        />

        <div className="flex-1 min-w-0">
          {renderActiveSection()}
        </div>
      </div>

      {/* Sticky Save Footer */}
      <SaveChangesFooter
        hasChanges={combinedHasChanges}
        saving={saving}
        onSave={saveChanges}
        onDiscard={discardChanges}
      />
    </div>
  );
};

export default Settings;
