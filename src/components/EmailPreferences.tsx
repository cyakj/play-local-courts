
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  created_at?: string;
  updated_at?: string;
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
      console.log('Loading email preferences for user:', currentUser.id);
      
      // Use rpc or raw query since the table might not be in types yet
      const { data, error } = await supabase
        .rpc('exec_sql', {
          sql: `SELECT * FROM email_preferences WHERE user_id = $1`,
          params: [currentUser.id]
        })
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences, trying direct query:', error);
        
        // Fallback to direct query
        const response = await fetch(`${supabase.supabaseUrl}/rest/v1/email_preferences?user_id=eq.${currentUser.id}`, {
          headers: {
            'apikey': supabase.supabaseKey,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.length > 0) {
            setPreferences(result[0] as EmailPreference);
          } else {
            await createDefaultPreferences();
          }
        } else {
          throw new Error('Failed to fetch preferences');
        }
      } else if (data) {
        setPreferences(data as EmailPreference);
      } else {
        await createDefaultPreferences();
      }
    } catch (error) {
      console.error('Error loading email preferences:', error);
      await createDefaultPreferences();
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    if (!currentUser) return;

    try {
      console.log('Creating default email preferences');
      
      const defaultPrefs = {
        user_id: currentUser.id,
        booking_confirmations: true,
        booking_reminders: true,
        cancellation_notifications: true,
        admin_announcements: true
      };

      const response = await fetch(`${supabase.supabaseUrl}/rest/v1/email_preferences`, {
        method: 'POST',
        headers: {
          'apikey': supabase.supabaseKey,
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(defaultPrefs)
      });

      if (response.ok) {
        const result = await response.json();
        setPreferences(result[0] as EmailPreference);
      } else {
        throw new Error('Failed to create default preferences');
      }
    } catch (error) {
      console.error('Error creating default preferences:', error);
      toast({
        title: "Error",
        description: "Failed to initialize email preferences",
        variant: "destructive"
      });
    }
  };

  const updatePreference = async (key: keyof EmailPreference, value: boolean) => {
    if (!preferences || !currentUser) return;

    setSaving(true);
    try {
      console.log(`Updating ${key} to ${value}`);
      
      const response = await fetch(`${supabase.supabaseUrl}/rest/v1/email_preferences?user_id=eq.${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabase.supabaseKey,
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ [key]: value })
      });

      if (response.ok) {
        const updatedPrefs = { ...preferences, [key]: value };
        setPreferences(updatedPrefs);
        toast({
          title: "Success",
          description: "Email preferences updated successfully"
        });
      } else {
        throw new Error('Failed to update preferences');
      }
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
