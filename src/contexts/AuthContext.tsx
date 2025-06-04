import React, { createContext, useState, useEffect, useContext } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User, UserRole, UserStatus } from '../types';
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
  logout: () => void;
  isAdmin: boolean;
  isPending: boolean;
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
      const userStatus = shouldBeAdmin ? UserStatus.APPROVED : UserStatus.PENDING;
      
      console.log('User role assignment:', { email, shouldBeAdmin, userRole, userStatus });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            hoa_id: hoaId,
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

      // Update the profile with additional info after creation
      if (data.user) {
        console.log('Updating user profile with additional data...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            hoa_id: hoaId,
            full_name: fullName,
            hoa_role: userRole,
            hoa_status: userStatus,
          })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          console.log('Profile updated successfully with role:', userRole);
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
        toast.success("Admin account created successfully! You have full access to the system.");
      } else {
        toast.success("Registration successful! Your account is pending approval from your HOA admin.");
      }
    } catch (error: any) {
      console.error('Registration error:', error);
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

  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    isAdmin,
    isPending
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
