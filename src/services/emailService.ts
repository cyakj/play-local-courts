
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

// Get user email preferences using RPC call
export const getUserEmailPreferences = async (userId: string): Promise<EmailPreference | null> => {
  try {
    const { data, error } = await supabase.rpc('get_email_preferences', { target_user_id: userId });
    
    if (error) {
      console.error('Error fetching email preferences:', error);
      return null;
    }
    
    // RPC functions return arrays, so get the first item
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching email preferences:', error);
    return null;
  }
};

// Create default email preferences for a user using RPC call
export const createDefaultEmailPreferences = async (userId: string): Promise<EmailPreference | null> => {
  try {
    const { data, error } = await supabase.rpc('create_default_email_preferences', { target_user_id: userId });
    
    if (error) {
      console.error('Error creating email preferences:', error);
      return null;
    }
    
    // RPC functions return arrays, so get the first item
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error creating email preferences:', error);
    return null;
  }
};

// Update specific email preference using RPC call
export const updateEmailPreference = async (
  userId: string, 
  key: keyof EmailPreference, 
  value: boolean
): Promise<boolean> => {
  try {
    const { error } = await supabase.rpc('update_email_preference', {
      target_user_id: userId,
      preference_key: key,
      preference_value: value
    });

    if (error) {
      console.error('Error updating email preference:', error);
      return false;
    }
    
    return true;
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
