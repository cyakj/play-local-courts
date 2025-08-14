
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [error, setError] = useState('');
  
  const { login, resetPassword } = useAuth();
  
  const handleLogin = async (e: React.FormEvent) => {
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

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    setError('');
    setIsResetting(true);
    
    try {
      await resetPassword(email);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsResetting(false);
    }
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>Access your HOA court reservation account</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}


        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={isResetting || !email}
            className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? 'Sending reset email...' : 'Forgot password?'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            To test the app, first create an account and then contact your HOA admin for approval.
          </p>
        </div>
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
