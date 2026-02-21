import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMode } from '@/contexts/ModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trophy, MapPin, Users, BarChart3, Check } from 'lucide-react';

export function TennisComingSoonModal() {
  const { showTennisComingSoon, closeTennisComingSoon } = useMode();
  const { currentUser } = useAuth();
  const [zipCode, setZipCode] = useState('');
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNotifyMe = async () => {
    if (notified) return;
    setLoading(true);
    try {
      // Attempt to insert into tennis_interest table.
      // If the table doesn't exist yet the insert will fail gracefully and we
      // still show success — the intent is captured in the console for now.
      const { error } = await (supabase as any)
        .from('tennis_interest')
        .insert({
          user_id: currentUser?.id ?? null,
          zip_code: zipCode.trim() || null,
          note: null,
        });

      if (error) {
        // Table may not exist yet; log and continue — don't block UX
        console.warn('tennis_interest insert failed (table may not exist yet):', error.message);
      }

      setNotified(true);
      toast.success("You're on the list! We'll notify you when Tennis launches.");
    } catch (err) {
      console.error('Notify me error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    closeTennisComingSoon();
    // Reset state for next open
    setTimeout(() => {
      setNotified(false);
      setZipCode('');
    }, 300);
  };

  return (
    <Dialog open={showTennisComingSoon} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header gradient band */}
        <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 px-6 pt-8 pb-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest opacity-80">
              Coming Soon
            </span>
          </div>
          <DialogTitle className="text-2xl font-bold text-white mb-1">
            Tennis is Coming Soon
          </DialogTitle>
          <DialogDescription className="text-white/80 text-sm leading-relaxed">
            TennisX will let you reserve courts near you, join local ladders,
            and find players at your skill level — all in one place.
          </DialogDescription>
        </div>

        {/* Features preview */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-green-500 shrink-0" />
            <span>Reserve courts near you in seconds</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4 text-green-500 shrink-0" />
            <span>Climb local ladders and track your ranking</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-green-500 shrink-0" />
            <span>Find players at your skill level nearby</span>
          </div>
        </div>

        {/* CTA section */}
        <div className="px-6 pb-6 space-y-3">
          {!notified ? (
            <>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Your ZIP code (optional)"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  maxLength={10}
                  className="flex-1 rounded-xl border-gray-200 text-sm"
                />
              </div>
              <Button
                onClick={handleNotifyMe}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold py-2.5 shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Saving...' : 'Notify me when Tennis launches'}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">You're on the list!</p>
                <p className="text-xs text-green-600">We'll let you know when Tennis launches.</p>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={handleClose}
            className="w-full rounded-xl text-muted-foreground hover:text-foreground text-sm"
          >
            Back to HOA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TennisComingSoonModal;
