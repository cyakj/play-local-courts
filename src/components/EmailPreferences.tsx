
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserEmailPreferences, 
  createDefaultEmailPreferences, 
  updateEmailPreference,
  EmailPreference 
} from '../services/emailService';

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
      
      const userPreferences = await getUserEmailPreferences(currentUser.id);
      
      if (userPreferences) {
        setPreferences(userPreferences);
      } else {
        // Create default preferences if none exist
        const defaultPreferences = await createDefaultEmailPreferences(currentUser.id);
        setPreferences(defaultPreferences);
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

  const handleUpdatePreference = async (key: keyof EmailPreference, value: boolean) => {
    if (!preferences || !currentUser) return;

    setSaving(true);
    try {
      console.log(`Updating ${key} to ${value}`);
      
      const success = await updateEmailPreference(currentUser.id, key, value);
      
      if (success) {
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
            onCheckedChange={(checked) => handleUpdatePreference('booking_confirmations', checked)}
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
            onCheckedChange={(checked) => handleUpdatePreference('booking_reminders', checked)}
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
            onCheckedChange={(checked) => handleUpdatePreference('cancellation_notifications', checked)}
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
            onCheckedChange={(checked) => handleUpdatePreference('admin_announcements', checked)}
            disabled={saving}
          />
        </div>

        <div className="border-t pt-6 mt-6">
          <h3 className="font-medium mb-4">Lesson Notifications</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="lesson-confirmations">Lesson Confirmations</Label>
                <p className="text-sm text-gray-500">
                  Receive emails when your lesson requests are confirmed
                </p>
              </div>
              <Switch
                id="lesson-confirmations"
                checked={preferences.lesson_confirmations}
                onCheckedChange={(checked) => handleUpdatePreference('lesson_confirmations', checked)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="lesson-reminders">Lesson Reminders</Label>
                <p className="text-sm text-gray-500">
                  Receive reminder emails 1 hour before your lessons
                </p>
              </div>
              <Switch
                id="lesson-reminders"
                checked={preferences.lesson_reminders}
                onCheckedChange={(checked) => handleUpdatePreference('lesson_reminders', checked)}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6 mt-6">
          <h3 className="font-medium mb-4">Match Notifications</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="match-confirmations">Match Confirmations</Label>
                <p className="text-sm text-gray-500">
                  Receive emails when your match requests are confirmed
                </p>
              </div>
              <Switch
                id="match-confirmations"
                checked={preferences.match_confirmations}
                onCheckedChange={(checked) => handleUpdatePreference('match_confirmations', checked)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="match-reminders">Match Reminders</Label>
                <p className="text-sm text-gray-500">
                  Receive reminder emails 1 hour before your matches
                </p>
              </div>
              <Switch
                id="match-reminders"
                checked={preferences.match_reminders}
                onCheckedChange={(checked) => handleUpdatePreference('match_reminders', checked)}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailPreferences;
