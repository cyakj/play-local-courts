
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const inputBase: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  padding: '14px 16px',
  fontSize: 15,
  color: '#0F1F3D',
  fontFamily: 'Inter, sans-serif',
  background: 'white',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, outline 0.15s',
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const { login, resetPassword } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Clear stale local session before login to prevent token collisions
      await supabase.auth.signOut({ scope: 'local' });
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address to reset your password');
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

  const fieldStyle = (field: string): React.CSSProperties => ({
    ...inputBase,
    border: `1px solid ${focused === field ? '#00D4FF' : 'rgba(15,31,61,0.15)'}`,
    outline: focused === field ? '2px solid rgba(0,212,255,0.2)' : 'none',
    outlineOffset: 0,
  });

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0px 12px 32px rgba(15,31,61,0.04)',
        border: '1px solid rgba(15,31,61,0.06)',
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#0F1F3D',
          fontFamily: 'Manrope, sans-serif',
          marginBottom: 4,
          lineHeight: 1.2,
        }}
      >
        Welcome back
      </h1>
      <p style={{ fontSize: 14, color: '#8892A4', marginBottom: 24, fontFamily: 'Inter, sans-serif' }}>
        Sign in to your TenisX account
      </p>

      {error && (
        <div
          style={{
            background: '#FFF5F5',
            border: '1px solid #F97066',
            color: '#C0392B',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#0F1F3D',
              marginBottom: 6,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            style={{
              ...fieldStyle('email'),
              color: isLoading ? '#9CA3AF' : '#0F1F3D',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="password"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#0F1F3D',
              marginBottom: 6,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            style={{
              ...fieldStyle('password'),
              color: isLoading ? '#9CA3AF' : '#0F1F3D',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: 52,
            background: isLoading ? '#8892A4' : '#0F1F3D',
            color: 'white',
            borderRadius: 8,
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Manrope, sans-serif',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '0 16px',
            transition: 'background 0.15s',
          }}
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleResetPassword}
          disabled={isResetting}
          style={{
            fontSize: 14,
            color: '#00D4FF',
            background: 'none',
            border: 'none',
            cursor: isResetting ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            opacity: isResetting ? 0.6 : 1,
          }}
        >
          {isResetting ? 'Sending reset email…' : 'Forgot password?'}
        </button>
      </div>

      <div
        style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid rgba(15,31,61,0.08)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 14, color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
          Don't have an account?{' '}
          <Link
            to="/register"
            style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign up
          </Link>
        </p>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Link
          to="/reviewer/login"
          style={{ fontSize: 12, color: '#8892A4', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}
        >
          RallyNet Personnel Login
        </Link>
      </div>
    </div>
  );
};

export default Login;
