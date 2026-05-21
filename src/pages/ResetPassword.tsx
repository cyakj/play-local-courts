import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ResetPassword — handles both PKCE (?code=) and implicit (#access_token=&type=recovery) flows.
//
// PKCE flow (supabase-js v2 default with flowType:'pkce'):
//   Supabase sends ?code=<PKCE_code> in the redirect URL.
//   The client auto-exchanges the code on load (detectSessionInUrl:true) and fires
//   onAuthStateChange with SIGNED_IN. getSession() then returns the session.
//
// Implicit flow (legacy):
//   Supabase sends #access_token=...&type=recovery in the URL hash.
//   The client fires onAuthStateChange with PASSWORD_RECOVERY.
//
// This page registers onAuthStateChange BEFORE calling getSession() so it never
// misses an event that was fired synchronously during client initialization.

const ResetPassword = () => {
  const navigate = useNavigate();
  // 'pending' = waiting for session check, 'valid' = can reset, 'expired' = link invalid/expired
  const [status, setStatus] = useState<'pending' | 'valid' | 'expired'>('pending');
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  // Track if we already resolved status so the listener and init don't race
  const resolvedRef = useRef(false);

  const isValid = useMemo(() => {
    if (!password || !confirmPassword) return false;
    if (password.length < 8) return false;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const resolve = (valid: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setStatus(valid ? 'valid' : 'expired');
  };

  useEffect(() => {
    let mounted = true;

    // 1. Register listener first — catches events fired synchronously by the client
    //    when it auto-exchanges the ?code= param (detectSessionInUrl:true).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // PASSWORD_RECOVERY = implicit flow; SIGNED_IN = PKCE flow after code exchange.
      // Both mean we have a valid recovery session.
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        resolve(true);
      }
    });

    // 2. Attempt to get the current session. getSession() awaits the client's
    //    internal initializePromise, so it resolves after any auto-exchange is done.
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) throw error;

        if (data.session) {
          resolve(true);
          return;
        }

        // 3. No session: check if a ?code= is present but wasn't auto-exchanged
        //    (e.g. link opened in a different browser where the PKCE verifier is absent).
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (!exchangeError && exchangeData.session) {
            resolve(true);
          } else {
            console.error("Reset password — code exchange failed:", exchangeError);
            resolve(false);
          }
          return;
        }

        // 4. Also check URL hash for implicit flow (#access_token=...&type=recovery)
        //    in case the client didn't fire the event yet.
        const hash = window.location.hash.substring(1);
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const type = hashParams.get('type');
          const accessToken = hashParams.get('access_token');
          if (type === 'recovery' && accessToken) {
            // Session should be set by the client; call getSession once more.
            const { data: retryData } = await supabase.auth.getSession();
            if (!mounted) return;
            resolve(!!retryData.session);
            return;
          }
        }

        // 5. Check for explicit error params Supabase may forward when the link is
        //    expired or the redirect URL is not whitelisted.
        const errorCode = params.get('error_code');
        if (errorCode) {
          console.warn("Reset password — Supabase error in URL:", params.get('error'), errorCode);
        }

        // No code, no hash, no session — link is invalid or expired.
        resolve(false);
      } catch (e: unknown) {
        console.error("Reset password init error:", e);
        if (!mounted) return;
        resolve(false);
      }
    };

    init();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated successfully.");
      await supabase.auth.signOut();
      navigate("/login", { replace: true, state: { message: "Password updated. Please sign in with your new password." } });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "Failed to update password.";
      console.error("Update password error:", e);
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 15,
    color: '#0F1F3D',
    fontFamily: 'Inter, sans-serif',
    background: 'white',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, outline 0.15s',
  };

  const fieldStyle = (field: string): React.CSSProperties => ({
    ...inputBase,
    border: `1px solid ${focused === field ? '#00D4FF' : '#E5E7EB'}`,
    outline: focused === field ? '2px solid rgba(0,212,255,0.2)' : 'none',
    outlineOffset: 0,
  });

  if (status === 'pending') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '2px solid rgba(0,212,255,0.2)',
            borderTopColor: '#00D4FF',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F9FAFB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <img
            src="/images/TenisX_logo-removebg-preview.png"
            alt="TenisX"
            style={{ height: 64, width: 'auto', maxWidth: 180 }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0px 4px 6px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.06)',
            border: '1px solid rgba(15,31,61,0.06)',
          }}
        >
          {status === 'valid' ? (
            <>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#0F1F3D',
                  fontFamily: 'Manrope, sans-serif',
                  marginBottom: 6,
                  lineHeight: 1.2,
                }}
              >
                Reset Your Password
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: '#4B5563',
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: 24,
                }}
              >
                Enter your new password below.
              </p>

              {errorMsg && (
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
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleUpdatePassword}>
                <div style={{ marginBottom: 16 }}>
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
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    style={fieldStyle('password')}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    htmlFor="confirmPassword"
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#0F1F3D',
                      marginBottom: 6,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                    onFocus={() => setFocused('confirmPassword')}
                    onBlur={() => setFocused(null)}
                    style={fieldStyle('confirmPassword')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  style={{
                    width: '100%',
                    minHeight: 52,
                    background: (!isValid || submitting) ? '#8892A4' : '#0F1F3D',
                    color: 'white',
                    borderRadius: 12,
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'Manrope, sans-serif',
                    cursor: (!isValid || submitting) ? 'not-allowed' : 'pointer',
                    padding: '0 16px',
                    transition: 'background 0.15s',
                  }}
                >
                  {submitting ? "Updating..." : "Set New Password"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Expired / invalid state */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(249,112,102,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>

              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#0F1F3D',
                  fontFamily: 'Manrope, sans-serif',
                  marginBottom: 8,
                  lineHeight: 1.2,
                  textAlign: 'center',
                }}
              >
                Link Expired
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: '#4B5563',
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: 24,
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                This reset link has expired or is invalid. Password reset links are valid for a limited time.
                Please request a new one.
              </p>

              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  width: '100%',
                  minHeight: 52,
                  background: '#0F1F3D',
                  color: 'white',
                  borderRadius: 12,
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'Manrope, sans-serif',
                  cursor: 'pointer',
                  padding: '0 16px',
                  transition: 'background 0.15s',
                }}
              >
                Back to Login
              </button>
            </>
          )}

          {/* Back to login link */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate("/login")}
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
      </div>
    </div>
  );
};

export default ResetPassword;
