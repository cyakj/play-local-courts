
import { supabase } from '@/integrations/supabase/client';

export interface EmailPreference {
  id: string;
  user_id: string;
  booking_confirmations: boolean;
  booking_reminders: boolean;
  cancellation_notifications: boolean;
  admin_announcements: boolean;
  created_at?: string;
  updated_at?: string;
}

// Get user email preferences
export const getUserEmailPreferences = async (userId: string): Promise<EmailPreference | null> => {
  try {
    const response = await fetch(`${supabase.supabaseUrl}/rest/v1/email_preferences?user_id=eq.${userId}`, {
      headers: {
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      return result.length > 0 ? result[0] : null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching email preferences:', error);
    return null;
  }
};

// Create default email preferences for a user
export const createDefaultEmailPreferences = async (userId: string): Promise<EmailPreference | null> => {
  try {
    const defaultPrefs = {
      user_id: userId,
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
      return result[0];
    }
    return null;
  } catch (error) {
    console.error('Error creating email preferences:', error);
    return null;
  }
};

// Update specific email preference
export const updateEmailPreference = async (
  userId: string, 
  key: keyof EmailPreference, 
  value: boolean
): Promise<boolean> => {
  try {
    const response = await fetch(`${supabase.supabaseUrl}/rest/v1/email_preferences?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ [key]: value })
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating email preference:', error);
    return false;
  }
};

// Check if user should receive specific email type
export const shouldSendEmail = async (userId: string, emailType: keyof EmailPreference): Promise<boolean> => {
  const preferences = await getUserEmailPreferences(userId);
  if (!preferences) {
    // If no preferences found, default to true for all notifications
    return true;
  }
  return preferences[emailType] as boolean;
};
