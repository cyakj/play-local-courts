
import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

// Six-digit OTP boxes for MFA verification
const OTPInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        onChange(value.slice(0, idx) + value.slice(idx + 1));
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const arr = digits.map((d, i) => (i === idx ? char : d));
    onChange(arr.join(''));
    if (idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '24px 0' }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: 48,
            height: 56,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'Manrope, sans-serif',
            color: '#0F1F3D',
            border: `1.5px solid ${digit ? '#00D4FF' : '#E5E7EB'}`,
            borderRadius: 8,
            background: 'white',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  // MFA state
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const { login, resetPassword } = useAuth();
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)?.message;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await supabase.auth.signOut({ scope: 'local' });
      await login(email, password);
    } catch (err: any) {
      if (err?.code === 'mfa_required' && err?.factorId) {
        // MFA required — show the verification screen
        setMfaFactorId(err.factorId);
        setError('');
      } else {
        setError(err.message || 'Failed to login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerify = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaVerifying(true);
    setError('');
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      toast.success('Login successful');
      // Auth state change listener in AuthContext will handle the navigation
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
      setMfaCode('');
    } finally {
      setMfaVerifying(false);
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

  // MFA Verification screen
  if (mfaFactorId) {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0px 12px 32px rgba(15,31,61,0.04)',
          border: '1px solid rgba(15,31,61,0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#E0F9FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
              <path d="M11 16a1 1 0 102 0 1 1 0 00-2 0"/>
              <path d="M8 11V7a4 4 0 018 0v4"/>
            </svg>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#0F1F3D',
              fontFamily: 'Manrope, sans-serif',
              marginBottom: 6,
              lineHeight: 1.2,
            }}
          >
            Two-Factor Auth
          </h1>
          <p style={{ fontSize: 14, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#FFF5F5',
              border: '1px solid #F97066',
              color: '#C0392B',
              borderRadius: 8,
              padding: '10px 14px',
              marginTop: 16,
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <OTPInput value={mfaCode} onChange={setMfaCode} disabled={mfaVerifying} />

        <button
          type="button"
          onClick={handleMFAVerify}
          disabled={mfaCode.length !== 6 || mfaVerifying}
          style={{
            width: '100%',
            minHeight: 52,
            background: mfaCode.length !== 6 || mfaVerifying ? '#8892A4' : '#0F1F3D',
            color: 'white',
            borderRadius: 12,
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Manrope, sans-serif',
            cursor: mfaCode.length !== 6 || mfaVerifying ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {mfaVerifying ? 'Verifying…' : 'Verify'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => { setMfaFactorId(null); setMfaCode(''); setError(''); }}
            style={{
              fontSize: 14,
              color: '#00D4FF',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

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

      {successMessage && (
        <div
          style={{
            background: '#F0FFFE',
            border: '1px solid #00D4FF',
            color: '#0F1F3D',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {successMessage}
        </div>
      )}

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
