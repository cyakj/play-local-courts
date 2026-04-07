import React, { useState, useEffect } from 'react';
import { Copy, Check, Share2, RefreshCw, Link2Off, Link2, Users } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InviteLinkSheetProps {
  open: boolean;
  onClose: () => void;
  community: {
    id: string;
    name: string;
  };
}

const PUBLISHED_DOMAIN = 'https://play-local-courts.lovable.app';

const InviteLinkSheet: React.FC<InviteLinkSheetProps> = ({ open, onClose, community }) => {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joinCount, setJoinCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const inviteUrl = inviteCode ? `${PUBLISHED_DOMAIN}/join/${inviteCode}` : '';

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const [{ data: hoa }, { count }] = await Promise.all([
        supabase
          .from('hoas')
          .select('invite_code, invite_enabled')
          .eq('id', community.id)
          .single(),
        supabase
          .from('hoa_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('hoa_id', community.id)
          .eq('joined_via_invite', true),
      ]);
      if (hoa) {
        setInviteCode(hoa.invite_code);
        setInviteEnabled(hoa.invite_enabled ?? true);
      }
      setJoinCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [open, community.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Copied ✓', { duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${community.name} on TenisX`,
          text: `You've been invited to join ${community.name} on TenisX. Click the link to create your account and get access to bookings, announcements, and community features.`,
          url: inviteUrl,
        });
      } catch (e: any) {
        if (e.name !== 'AbortError') handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('This will invalidate the old link. Anyone with the old link won\'t be able to use it. Continue?')) return;
    const { data, error } = await supabase.rpc('regenerate_invite_code', { _hoa_id: community.id });
    if (error) {
      toast.error('Failed to regenerate');
    } else {
      setInviteCode(data as string);
      toast.success('Link regenerated');
    }
  };

  const handleToggleEnabled = async () => {
    const newVal = !inviteEnabled;
    const { error } = await supabase
      .from('hoas')
      .update({ invite_enabled: newVal })
      .eq('id', community.id);
    if (error) {
      toast.error('Failed to update');
    } else {
      setInviteEnabled(newVal);
      toast.success(newVal ? 'Link enabled' : 'Link disabled');
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="bg-white rounded-t-2xl max-h-[85vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle className="text-lg font-extrabold" style={{ color: '#1A1A2E' }}>
            Invite Residents to {community.name}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-5 pb-6 overflow-y-auto">
          <p className="text-[13px] leading-[1.6] mt-1 mb-5" style={{ color: '#9CA3AF' }}>
            Share this link with your residents. Anyone who signs up using this link will be automatically connected to your community as a pending member.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#00B4D8' }} />
            </div>
          ) : (
            <>
              {/* Link display card */}
              <div
                className="flex items-center justify-between gap-2 mb-4"
                style={{
                  background: '#fff',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 14,
                  padding: '14px 16px',
                }}
              >
                <div
                  className="flex-1 truncate text-[13px] font-semibold"
                  style={{ color: inviteEnabled ? '#1A1A2E' : '#9CA3AF', fontFamily: 'ui-monospace, monospace' }}
                >
                  {inviteEnabled ? inviteUrl : 'Link disabled'}
                </div>
                {inviteEnabled && (
                  <div
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer shrink-0 min-h-[36px]"
                    style={{ background: '#00B4D8', color: '#fff', borderRadius: 10 }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </div>
                )}
              </div>

              {/* Share button */}
              {inviteEnabled && (
                <div
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-sm font-bold cursor-pointer mb-5 min-h-[48px]"
                  style={{ background: '#1A1A2E', color: '#fff' }}
                >
                  <Share2 className="h-4 w-4" />
                  Share →
                </div>
              )}

              {/* Link management */}
              <div className="flex items-center justify-between mb-4" style={{ borderTop: '1px solid #F3F4F6', paddingTop: 14 }}>
                <div
                  onClick={handleRegenerate}
                  className="flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer min-h-[44px]"
                  style={{ color: '#9CA3AF' }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Link
                </div>
                <div
                  onClick={handleToggleEnabled}
                  className="flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer min-h-[44px]"
                  style={{ color: inviteEnabled ? '#9CA3AF' : '#00B4D8' }}
                >
                  {inviteEnabled ? <Link2Off className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {inviteEnabled ? 'Disable Link' : 'Enable Link'}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#9CA3AF' }}>
                <Users className="h-3.5 w-3.5" />
                {joinCount} resident{joinCount !== 1 ? 's' : ''} joined via this link
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default InviteLinkSheet;
