import React, { createContext, useState, useEffect, useContext } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User, UserRole, UserStatus, UserType } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserProfile } from '../services/supabaseService';
import { createDefaultEmailPreferences } from '../services/emailService';
import { isAdminEmail } from '../config/adminEmails';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phoneNumber: string | undefined, dateOfBirth: string | undefined, hoaId: string) => Promise<void>;
  registerCoach: (fullName: string, email: string, password: string, coachData: any) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isPending: boolean;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          console.log('User authenticated, fetching profile...');
          // Use setTimeout to avoid potential recursive issues
          setTimeout(async () => {
            try {
              const userProfile = await getCurrentUserProfile();
              console.log('User profile fetched:', userProfile);
              setCurrentUser(userProfile);
            } catch (error) {
              console.error('Error fetching user profile:', error);
              setCurrentUser(null);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          console.log('No user session found');
          setCurrentUser(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting to login user:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      console.log('Login successful:', data.user?.id);
      toast.success("Login successful");
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (
    fullName: string, 
    email: string, 
    password: string, 
    phoneNumber: string | undefined, 
    dateOfBirth: string | undefined, 
    hoaId: string
  ) => {
    try {
      console.log('Attempting to register user:', email, 'with HOA:', hoaId);
      
      // Determine if this email should get admin privileges
      const shouldBeAdmin = isAdminEmail(email);
      const userRole = shouldBeAdmin ? UserRole.ADMIN : UserRole.RESIDENT;
      // Only require approval if user has an HOA and is not an admin
      const userStatus = shouldBeAdmin ? UserStatus.APPROVED : (hoaId ? UserStatus.PENDING : UserStatus.APPROVED);
      
      console.log('User role assignment:', { email, shouldBeAdmin, userRole, userStatus, hoaId });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            hoa_id: hoaId || null, // Allow null HOA ID for non-HOA users
            hoa_role: userRole,
            hoa_status: userStatus,
          }
        }
      });

      if (error) {
        console.error('Registration error:', error);
        if (error.message.includes('already registered')) {
          toast.error("Email already registered");
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      console.log('Registration successful:', data.user?.id);

      // Ensure the profile gets created with the correct data immediately
      if (data.user) {
        console.log('Creating/updating user profile with HOA data...');
        
        // Wait a moment for the trigger to fire, then update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            hoa_id: hoaId || null, // Allow null HOA ID
            full_name: fullName,
            hoa_role: userRole,
            hoa_status: userStatus,
            user_type: hoaId ? UserType.HOA : UserType.NON_HOA, // Set user type based on HOA presence
          }, {
            onConflict: 'id'
          });

        if (updateError) {
          console.error('Error updating profile:', updateError);
          // Don't throw - registration was successful
        } else {
          console.log('Profile updated successfully with HOA:', hoaId || 'none', 'role:', userRole);
        }

        // Create default email preferences for the new user
        try {
          await createDefaultEmailPreferences(data.user.id);
          console.log('Default email preferences created for user');
        } catch (emailPrefError) {
          console.error('Error creating email preferences:', emailPrefError);
          // Don't throw error - registration was successful even if email prefs failed
        }
      }

      if (shouldBeAdmin) {
        toast.success("Admin account created successfully! Please check your email to confirm your account.");
      } else if (hoaId) {
        toast.success("Registration successful! Please check your email to confirm your account, then wait for HOA admin approval.");
      } else {
        // Users without HOA don't need approval - set status to approved
        toast.success("Registration successful! Please check your email to confirm your account.");
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const registerCoach = async (
    fullName: string,
    email: string,
    password: string,
    coachData: any
  ) => {
    try {
      console.log('Attempting to register coach:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            hoa_role: 'coach',
            hoa_status: 'approved', // Coaches don't need HOA approval
          }
        }
      });

      if (error) {
        console.error('Coach registration error:', error);
        throw error;
      }

      if (data.user) {
        // Create coach profile
        const { error: coachError } = await supabase
          .from('coaches')
          .insert({
            user_id: data.user.id,
            business_name: coachData.businessName || null,
            credentials: coachData.credentials,
            years_experience: coachData.yearsExperience,
            sports_offered: coachData.sportsOffered,
            home_base: coachData.homeBase,
            willing_to_travel: coachData.willingToTravel,
            hourly_rate: coachData.hourlyRate || null,
            bio: coachData.bio || null
          });

        if (coachError) {
          console.error('Error creating coach profile:', coachError);
          throw new Error('Failed to create coach profile');
        }

        // Create default email preferences for the new coach
        try {
          await createDefaultEmailPreferences(data.user.id);
          console.log('Default email preferences created for coach');
        } catch (emailPrefError) {
          console.error('Error creating email preferences:', emailPrefError);
          // Don't throw error - registration was successful even if email prefs failed
        }

        toast.success("Coach registration successful! Please check your email to confirm your account.");
      }
    } catch (error: any) {
      console.error('Coach registration error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Sending password reset email to:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dashboard`,
      });

      if (error) {
        console.error('Password reset error:', error);
        toast.error(error.message);
        throw error;
      }

      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out user...');
      await supabase.auth.signOut();
      setCurrentUser(null);
      setSession(null);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error('Logout error:', error);
      toast.error("Error logging out");
    }
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isPending = currentUser?.status === UserStatus.PENDING;
  // Check if user is a coach by looking at their profiles table hoa_role field
  // Since we don't have direct access to hoa_role on the User type, we'll need to check for coach role differently
  // For now, we'll return false and this will need to be properly implemented when we have the correct data flow
  const isCoach = false; // TODO: Implement proper coach role checking

  const value = {
    currentUser,
    loading,
    login,
    register,
    registerCoach,
    resetPassword,
    logout,
    isAdmin,
    isPending,
    isCoach
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
