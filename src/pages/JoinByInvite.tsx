import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

type PublicInviteCommunity = {
  id: string;
  name: string;
  invite_enabled: boolean;
  invite_expires_at: string | null;
};

const JoinByInvite = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [community, setCommunity] = useState<{ id: string; name: string; invite_enabled: boolean; invite_expires_at: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .rpc('get_public_hoa_invite_by_code', { _invite_code: inviteCode! });
      const inviteCommunity = data?.[0] as PublicInviteCommunity | undefined;

      if (fetchErr || !inviteCommunity) {
        setError('This invite link is no longer valid. Please contact your community manager for a new link.');
        setLoading(false);
        return;
      }

      if (!inviteCommunity.invite_enabled) {
        setError('This invite link has been disabled. Please contact your community manager for a new link.');
        setLoading(false);
        return;
      }

      if (inviteCommunity.invite_expires_at && new Date(inviteCommunity.invite_expires_at) < new Date()) {
        setError('This invite link has expired. Please contact your community manager for a new link.');
        setLoading(false);
        return;
      }

      setCommunity(inviteCommunity);

      // Get member count
      const { count } = await supabase
        .from('hoa_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('hoa_id', inviteCommunity.id)
        .eq('status', 'approved');
      setMemberCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!currentUser || !community) return;
    setJoining(true);

    // Check if already a member
    const { data: existing } = await supabase
      .from('hoa_memberships')
      .select('id, status')
      .eq('user_id', currentUser.id)
      .eq('hoa_id', community.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'approved') {
        toast.info('You are already a member of this community');
        navigate('/');
      } else if (existing.status === 'pending') {
        toast.info('Your request is already pending');
        setJoined(true);
      } else {
        toast.error('Your membership was previously rejected. Contact the community manager.');
      }
      setJoining(false);
      return;
    }

    const { error: insertErr } = await supabase.from('hoa_memberships').insert({
      user_id: currentUser.id,
      hoa_id: community.id,
      role: 'resident',
      status: 'pending',
      joined_via_invite: true,
      invite_code_used: inviteCode,
    });

    if (insertErr) {
      toast.error('Failed to send join request');
    } else {
      setJoined(true);
    }
    setJoining(false);
  };

  // Not logged in — show branded landing
  if (!loading && !error && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(180deg, #0B1D3A 0%, #132B52 100%)' }}>
        <div className="text-3xl font-black text-white mb-2">TenisX</div>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(0,180,216,0.15)' }}>
          <Users className="h-8 w-8" style={{ color: '#00B4D8' }} />
        </div>
        <div className="text-center mb-8">
          <div className="text-xl font-extrabold text-white mb-2">You've been invited to join</div>
          <div className="text-2xl font-black" style={{ color: '#00B4D8' }}>{community?.name}</div>
          <div className="text-sm text-white/60 mt-2">{memberCount} members</div>
        </div>
        <div
          onClick={() => navigate(`/register?redirect=/join/${inviteCode}`)}
          className="w-full max-w-xs rounded-xl py-3.5 text-center text-sm font-bold cursor-pointer mb-3 min-h-[48px] flex items-center justify-center gap-2"
          style={{ background: '#00B4D8', color: '#fff' }}
        >
          Create Account <ArrowRight className="h-4 w-4" />
        </div>
        <div
          onClick={() => navigate(`/login?redirect=/join/${inviteCode}`)}
          className="text-sm font-semibold cursor-pointer min-h-[44px] flex items-center"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          I already have an account
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1D3A' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00B4D8' }} />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0B1D3A' }}>
        <XCircle className="h-16 w-16 mb-4" style={{ color: '#EF4444' }} />
        <div className="text-lg font-bold text-white text-center mb-6">{error}</div>
        <div
          onClick={() => navigate('/')}
          className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer min-h-[44px]"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
        >
          Go to Home
        </div>
      </div>
    );
  }

  // Joined successfully
  if (joined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0B1D3A' }}>
        <CheckCircle2 className="h-16 w-16 mb-4" style={{ color: '#10B981' }} />
        <div className="text-xl font-extrabold text-white text-center mb-2">Request sent!</div>
        <div className="text-sm text-center mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
          The community manager will review and approve your membership.
        </div>
        <div
          onClick={() => navigate('/')}
          className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer min-h-[44px]"
          style={{ background: '#00B4D8', color: '#fff' }}
        >
          Go to Dashboard
        </div>
      </div>
    );
  }

  // Logged in — confirmation screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0B1D3A' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(0,180,216,0.15)' }}>
        <Users className="h-8 w-8" style={{ color: '#00B4D8' }} />
      </div>
      <div className="text-xl font-extrabold text-white mb-1">Join {community?.name}?</div>
      <div className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>{memberCount} members</div>
      <div
        onClick={handleJoin}
        className="w-full max-w-xs rounded-xl py-3.5 text-center text-sm font-bold cursor-pointer min-h-[48px] flex items-center justify-center"
        style={{ background: '#00B4D8', color: '#fff', opacity: joining ? 0.6 : 1 }}
      >
        {joining ? 'Joining...' : 'Confirm & Join'}
      </div>
      <div
        onClick={() => navigate('/')}
        className="cursor-pointer mt-4 min-h-[44px] flex items-center underline"
        style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 500 }}
      >
        Cancel
      </div>
    </div>
  );
};

export default JoinByInvite;
