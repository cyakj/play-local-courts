
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, registerAdmin } = useAuth();
  
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      // Redirection is handled by the AuthLayout component
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (adminUsername === 'Boss' && adminPassword === 'greens') {
        await login(adminUsername, adminPassword);
      } else {
        throw new Error("Invalid admin credentials");
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login as admin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await registerAdmin(adminUsername, adminPassword);
      // Redirection is handled by the AuthLayout component
    } catch (err: any) {
      setError(err.message || 'Failed to register as admin');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Demo login credentials for easy testing
  const loginAsAdmin = async () => {
    setAdminUsername('Boss');
    setAdminPassword('greens');
    setIsLoading(true);
    try {
      await login('Boss', 'greens');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loginAsResident = async () => {
    setEmail('alice@example.com');
    setPassword('password');
    setIsLoading(true);
    try {
      await login('alice@example.com', 'password');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>Access your account or register as admin</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <Tabs defaultValue="user" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user">User Login</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>
          
          <TabsContent value="user">
            <form onSubmit={handleUserLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log in'}
              </Button>

              <div className="mt-4">
                <Button variant="outline" onClick={loginAsResident} size="sm" disabled={isLoading} className="w-full">
                  Demo Login as Resident
                </Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="admin">
            <div className="mt-4 space-y-6">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminUsername">Admin Username</Label>
                  <Input
                    id="adminUsername"
                    placeholder="Admin username"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Admin Password</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    Login as Admin
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleAdminRegistration} 
                    variant="outline" 
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Register Admin
                  </Button>
                </div>
                <div className="mt-2">
                  <Button variant="outline" onClick={loginAsAdmin} size="sm" disabled={isLoading} className="w-full">
                    Demo Admin Login
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2 text-center">
                  <p>Admin Credentials: Username "Boss" Password "greens"</p>
                </div>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center w-full">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default Login;
