
import React, { createContext, useState, useEffect, useContext } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { mockUsers, mockHOAs } from '../services/mockDataService';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, dateOfBirth: string | undefined, hoaId: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isPending: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // In a real app, we would make an API call here
    const user = mockUsers.find(u => u.email === email);
    
    if (!user) {
      toast.error("User not found");
      throw new Error("User not found");
    }
    
    if (user.status === UserStatus.PENDING) {
      toast.error("Your account is pending approval by the HOA admin");
      throw new Error("Account pending approval");
    }
    
    if (user.status === UserStatus.REJECTED) {
      toast.error("Your account has been rejected by the HOA admin");
      throw new Error("Account rejected");
    }
    
    // In a real app, we would check the password here
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    toast.success("Login successful");
  };

  const register = async (fullName: string, email: string, password: string, dateOfBirth: string | undefined, hoaId: string) => {
    // Check if email already exists
    if (mockUsers.some(u => u.email === email)) {
      toast.error("Email already registered");
      throw new Error("Email already registered");
    }

    // In a real app, we would make an API call here to register the user
    const newUser: User = {
      id: `user${mockUsers.length + 1}`,
      fullName,
      email,
      dateOfBirth,
      role: UserRole.RESIDENT,
      status: UserStatus.PENDING,
      hoaId,
      createdAt: new Date().toISOString()
    };
    
    // Simulate adding to the database
    mockUsers.push(newUser);
    
    // Get HOA details for notification message
    const hoa = mockHOAs.find(h => h.hoaId === hoaId);
    
    toast.success("Registration successful! Your account is pending approval from the HOA admin.");
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    toast.success("Logged out successfully");
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
