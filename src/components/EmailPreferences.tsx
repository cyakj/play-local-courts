
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

interface EmailPreference {
  id: string;
  user_id: string;
  booking_confirmations: boolean;
  booking_reminders: boolean;
  cancellation_notifications: boolean;
  admin_announcements: boolean;
}

const EmailPreferences = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<EmailPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [currentUser]);

  const loadPreferences = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences if they don't exist
        const defaultPrefs = {
          user_id: currentUser.id,
          booking_confirmations: true,
          booking_reminders: true,
          cancellation_notifications: true,
          admin_announcements: true
        };

        const { data: newPrefs, error: createError } = await supabase
          .from('email_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (error) {
      console.error('Error loading email preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load email preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof EmailPreference, value: boolean) => {
    if (!preferences || !currentUser) return;

    setSaving(true);
    try {
      const updatedPrefs = { ...preferences, [key]: value };
      
      const { error } = await supabase
        .from('email_preferences')
        .update({ [key]: value })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setPreferences(updatedPrefs);
      toast({
        title: "Success",
        description: "Email preferences updated successfully"
      });
    } catch (error) {
      console.error('Error updating email preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update email preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-2">Loading preferences...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Unable to load email preferences</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="booking-confirmations">Booking Confirmations</Label>
            <p className="text-sm text-gray-500">
              Receive emails when your court reservations are confirmed
            </p>
          </div>
          <Switch
            id="booking-confirmations"
            checked={preferences.booking_confirmations}
            onCheckedChange={(checked) => updatePreference('booking_confirmations', checked)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="booking-reminders">Booking Reminders</Label>
            <p className="text-sm text-gray-500">
              Receive reminder emails the day before your reservation
            </p>
          </div>
          <Switch
            id="booking-reminders"
            checked={preferences.booking_reminders}
            onCheckedChange={(checked) => updatePreference('booking_reminders', checked)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="cancellation-notifications">Cancellation Notifications</Label>
            <p className="text-sm text-gray-500">
              Receive emails when your reservations are cancelled
            </p>
          </div>
          <Switch
            id="cancellation-notifications"
            checked={preferences.cancellation_notifications}
            onCheckedChange={(checked) => updatePreference('cancellation_notifications', checked)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="admin-announcements">Admin Announcements</Label>
            <p className="text-sm text-gray-500">
              Receive important announcements from HOA administrators
            </p>
          </div>
          <Switch
            id="admin-announcements"
            checked={preferences.admin_announcements}
            onCheckedChange={(checked) => updatePreference('admin_announcements', checked)}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailPreferences;
