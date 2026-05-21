import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface InAppNotificationPreferences {
  match_requests: boolean;
  lesson_updates: boolean;
  community_announcements: boolean;
  new_messages: boolean;
}

const DEFAULT_PREFERENCES: InAppNotificationPreferences = {
  match_requests: true,
  lesson_updates: true,
  community_announcements: true,
  new_messages: true,
};

export const useInAppNotifications = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<InAppNotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        // Access notification_preferences from the raw data
        const notifPrefs = (data as any).notification_preferences;
        if (notifPrefs) {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...notifPrefs,
          });
        }
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const updatePreference = async (key: keyof InAppNotificationPreferences, value: boolean) => {
    if (!currentUser) return false;

    setSaving(true);
    try {
      const newPreferences = { ...preferences, [key]: value };
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          notification_preferences: newPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setPreferences(newPreferences);
      return true;
    } catch (error) {
      console.error('Error updating notification preference:', error);
      toast({
        title: "Error",
        description: "Failed to update notification preference",
        variant: "destructive"
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    preferences,
    loading,
    saving,
    updatePreference,
    reload: loadPreferences
  };
};
