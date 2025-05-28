import React, { createContext, useState, useEffect, useContext } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { mockUsers, mockHOAs } from '../services/mockDataService';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phoneNumber: string | undefined, dateOfBirth: string | undefined, hoaId: string) => Promise<void>;
  registerAdmin: (username: string, password: string) => Promise<void>;
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
    const loadUserFromStorage = () => {
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
        }
      } catch (error) {
        console.error("Error loading user from localStorage:", error);
        localStorage.removeItem('currentUser'); // Clear corrupted data
      } finally {
        setLoading(false);
      }
    };

    loadUserFromStorage();
  }, []);

  const login = async (email: string, password: string) => {
    // For admin login with preset credentials
    if (email === 'Boss' && password === 'greens') {
      const adminUser = mockUsers.find(u => u.role === UserRole.ADMIN);
      if (adminUser) {
        setCurrentUser(adminUser);
        try {
          localStorage.setItem('currentUser', JSON.stringify(adminUser));
          toast.success("Admin login successful");
        } catch (error) {
          console.error("Error saving user to localStorage:", error);
          toast.error("Failed to save login session");
        }
        return;
      }
    }
    
    // Regular user login
    const user = mockUsers.find(u => u.email === email);
    
    if (!user) {
      toast.error("User not found");
      throw new Error("User not found");
    }
    
    if (user.status === UserStatus.PENDING) {
      toast.error("Your account is pending approval by your HOA administrator. You will be notified once approved.");
      throw new Error("Account pending approval");
    }
    
    if (user.status === UserStatus.REJECTED) {
      toast.error("Your account has been rejected by the HOA admin");
      throw new Error("Account rejected");
    }
    
    setCurrentUser(user);
    
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
      toast.success("Login successful");
    } catch (error) {
      console.error("Error saving user to localStorage:", error);
      toast.error("Failed to save login session");
    }
  };

  const register = async (fullName: string, email: string, password: string, phoneNumber: string | undefined, dateOfBirth: string | undefined, hoaId: string) => {
    // Check if email already exists
    if (mockUsers.some(u => u.email === email)) {
      toast.error("Email already registered");
      throw new Error("Email already registered");
    }

    // In a real app, we would make an API call here to register the user
    const newUser: User = {
      id: `user${Date.now()}`, // More unique ID using timestamp
      fullName,
      email,
      phoneNumber,
      dateOfBirth,
      role: UserRole.RESIDENT,
      status: UserStatus.PENDING,
      hoaId,
      createdAt: new Date().toISOString()
    };
    
    // Add to the mockUsers array directly
    mockUsers.push(newUser);
    console.log("User registered:", newUser);
    console.log("Updated mockUsers:", mockUsers);
    
    // Get HOA details for notification message
    const hoa = mockHOAs.find(h => h.id === hoaId);
    
    toast.success(`Registration successful! Your account is pending approval from ${hoa?.name || 'your HOA'} admin.`);
  };

  // New function to register an admin with preset credentials
  const registerAdmin = async (username: string, password: string) => {
    // Verify preset credentials
    if (username !== 'Boss' || password !== 'greens') {
      toast.error("Invalid admin credentials");
      throw new Error("Invalid admin credentials");
    }
    
    // Check if admin already exists for the default HOA
    const existingAdmin = mockUsers.find(u => u.role === UserRole.ADMIN && u.hoaId === "1");
    
    if (existingAdmin) {
      toast.error("An admin account already exists");
      throw new Error("Admin already exists");
    }

    // Create new admin user
    const newAdmin: User = {
      id: `admin${mockUsers.length + 1}`,
      fullName: "Administrator",
      email: "admin@example.com", // This won't be used for login, but we need it for the User type
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
      hoaId: "1", // Default to the first HOA
      createdAt: new Date().toISOString()
    };
    
    // Add admin to mock users
    mockUsers.push(newAdmin);
    
    // Log in the admin automatically
    setCurrentUser(newAdmin);
    try {
      localStorage.setItem('currentUser', JSON.stringify(newAdmin));
      toast.success("Admin account created and logged in successfully");
    } catch (error) {
      console.error("Error saving admin to localStorage:", error);
      toast.error("Failed to save login session");
    }
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
    registerAdmin,
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
