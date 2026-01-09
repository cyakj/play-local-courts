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

    const init = async () => {
      try {
        // supabase-js will auto-detect a recovery session from the URL when the link opens.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;
        setHasSession(Boolean(data.session));
      } catch (e: any) {
        console.error("Reset password init error:", e);
        if (!mounted) return;
        setHasSession(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
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
      navigate("/login", { replace: true });
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
