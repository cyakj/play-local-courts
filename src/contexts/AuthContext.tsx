
import React, { createContext, useState, useEffect, useContext } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User, UserRole, UserStatus } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserProfile } from '../services/supabaseService';
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          // Fetch user profile from our profiles table
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      // The auth state change listener will handle setting the user
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            hoa_id: hoaId,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error("Email already registered");
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      // Update the profile with additional info after creation
      if (data.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            hoa_id: hoaId,
            full_name: fullName,
          })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        }
      }

      toast.success("Registration successful! Your account is pending approval from your HOA admin.");
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
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
