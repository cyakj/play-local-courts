import React, { createContext, useState, useEffect, useContext } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User, UserRole, UserStatus, UserType } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserProfile } from '../services/supabaseService';
import { createDefaultEmailPreferences } from '../services/emailService';
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
  isPlatformReviewer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

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
              
              // Fetch user roles from user_roles table
              const { data: rolesData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id);
              
              setUserRoles(rolesData?.map(r => r.role) || []);

              // Complete coach setup after first authenticated session
              const userMeta = (session.user as any)?.user_metadata;
              if (userMeta?.hoa_role === 'coach') {
                try {
                  // Ensure profile exists with minimal data
                  const { error: profileUpsertError } = await supabase
                    .from('profiles')
                    .upsert(
                      {
                        id: session.user.id,
                        full_name: userMeta?.full_name || null,
                        hoa_status: 'approved',
                      },
                      { onConflict: 'id' }
                    );
                  if (profileUpsertError) {
                    console.error('Error upserting coach user profile:', profileUpsertError);
                  }

                  // Ensure coach profile exists with metadata-provided details
                  const { data: existingCoach } = await supabase
                    .from('coaches')
                    .select('id')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                  if (!existingCoach) {
                    const coachPayload: any = {
                      user_id: session.user.id,
                      business_name: userMeta?.business_name ?? null,
                      credentials: userMeta?.credentials ?? null,
                      years_experience: userMeta?.years_experience ?? null,
                      sports_offered: userMeta?.sports_offered ?? [],
                      home_base: userMeta?.home_base ?? null,
                      willing_to_travel: userMeta?.willing_to_travel ?? false,
                      hourly_rate: userMeta?.hourly_rate ?? null,
                      bio: userMeta?.bio ?? null,
                    };

                    const { error: coachInsertError } = await supabase
                      .from('coaches')
                      .insert(coachPayload);
                    if (coachInsertError) {
                      console.error('Error creating coach profile from metadata:', coachInsertError);
                    } else {
                      console.log('Coach profile created from metadata for user:', session.user.id);
                    }
                  }

                  // Ensure default email preferences exist
                  try {
                    await createDefaultEmailPreferences(session.user.id);
                  } catch (emailPrefError) {
                    console.error('Error ensuring email preferences for coach:', emailPrefError);
                  }
                } catch (coachSetupError) {
                  console.error('Error during coach setup after login:', coachSetupError);
                }
              }
            } catch (error) {
              console.error('Error fetching user profile:', error);
              setCurrentUser(null);
              setUserRoles([]);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          console.log('No user session found');
          setCurrentUser(null);
          setUserRoles([]);
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
      
      // All new users are residents by default - admins must be granted via grant_admin_role()
      const userRole = UserRole.RESIDENT;
      // Only require approval if user has an HOA
      const userStatus = hoaId ? UserStatus.PENDING : UserStatus.APPROVED;
      
      console.log('User role assignment:', { email, userRole, userStatus, hoaId });
      
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

      if (hoaId) {
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

      // Store coach details in user metadata; we'll create DB rows after first login
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            hoa_role: 'coach',
            hoa_status: 'approved',
            // Coach profile metadata to be applied after email confirmation
            business_name: coachData?.businessName ?? null,
            credentials: coachData?.credentials ?? null,
            years_experience: coachData?.yearsExperience ?? null,
            sports_offered: coachData?.sportsOffered ?? [],
            home_base: coachData?.homeBase ?? null,
            willing_to_travel: coachData?.willingToTravel ?? false,
            hourly_rate: coachData?.hourlyRate ?? null,
            bio: coachData?.bio ?? null,
          }
        }
      });

      if (error) {
        console.error('Coach registration error:', error);
        throw error;
      }

      if (data.user) {
        // Do not attempt DB inserts here (no session yet). Finish after confirmation/login.
        toast.success('Account created! Please confirm your email, then log in to finish coach setup.');
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
      setUserRoles([]);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error('Logout error:', error);
      toast.error("Error logging out");
    }
  };

  // Check roles from user_roles table instead of profiles
  const isAdmin = userRoles.includes('admin');
  const isCoach = userRoles.includes('coach');
  const isPlatformReviewer = userRoles.includes('platform_reviewer');
  // Platform reviewers should never be considered "pending" - they're above HOA hierarchy
  const isPending = currentUser?.status === UserStatus.PENDING && !isPlatformReviewer;

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
    isCoach,
    isPlatformReviewer
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
