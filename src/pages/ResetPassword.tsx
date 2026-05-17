import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = useMemo(() => {
    if (!password || !confirmPassword) return false;
    if (password.length < 8) return false;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  useEffect(() => {
    let mounted = true;

    // With Supabase PKCE flow (default in supabase-js v2), the recovery email
    // link contains ?code=... instead of #access_token=...&type=recovery.
    // The client exchanges the code automatically, but fires SIGNED_IN (not
    // PASSWORD_RECOVERY) because the PKCE _getSessionFromURL sets redirectType=null.
    //
    // Strategy:
    // 1. Register onAuthStateChange early to catch SIGNED_IN or PASSWORD_RECOVERY.
    // 2. Call getSession() — it awaits initializePromise, so it resolves only
    //    after the code exchange completes. If a session exists we have the token.
    // 3. If still no session and URL has ?code=, manually call
    //    exchangeCodeForSession() to handle the cross-device / cross-tab case
    //    (when the PKCE code verifier is missing from this browser's localStorage).

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        // Accept both PASSWORD_RECOVERY (implicit flow) and SIGNED_IN (PKCE flow).
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          if (session) {
            setHasSession(true);
            setLoading(false);
          }
        }
      }
    );

    const init = async () => {
      try {
        // getSession() awaits initializePromise — safe to call immediately.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;

        if (data.session) {
          setHasSession(true);
          setLoading(false);
          return;
        }

        // No session yet. Check if a PKCE code is in the URL and the verifier
        // is missing from storage (cross-device / cross-tab scenario).
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (exchangeError) {
            console.error("Reset password code exchange error:", exchangeError);
            setHasSession(false);
          } else if (exchangeData.session) {
            setHasSession(true);
          } else {
            setHasSession(false);
          }
        } else {
          // No code param and no session — the link is invalid or expired.
          setHasSession(false);
        }
      } catch (e: unknown) {
        console.error("Reset password init error:", e);
        if (!mounted) return;
        setHasSession(false);
      } finally {
        if (mounted) setLoading(false);
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

    if (!hasSession) {
      toast.error("This reset link is invalid or expired. Please request a new one.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated. Please log in with your new password.");
      await supabase.auth.signOut();
      navigate("/login", { replace: true, state: { message: "Password updated. Please sign in." } });
    } catch (e: any) {
      console.error("Update password error:", e);
      toast.error(e?.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Reset password</CardTitle>
            <CardDescription>
              {hasSession
                ? "Choose a new password for your account."
                : "This reset link is invalid or expired. Request a new reset email."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {hasSession ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={!isValid || submitting}>
                  {submitting ? "Updating..." : "Update password"}
                </Button>
              </form>
            ) : (
              <Button className="w-full" onClick={() => navigate("/login")}
                >Back to login</Button>
            )}
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground">
            If you keep seeing “Invalid token”, request a new reset email and use the most recent link.
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default ResetPassword;
