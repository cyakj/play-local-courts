import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Community {
  id: string;
  name: string;
  address: string | null;
  memberCount: number;
}

const JoinCommunity = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Invite code
  const [inviteCode, setInviteCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  // Load existing pending memberships so we can show "Requested ✓"
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const { data } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', currentUser.id);
      if (data) setRequestedIds(new Set(data.map((d: any) => d.hoa_id)));
    })();
  }, [currentUser]);

  // Search communities
  useEffect(() => {
    if (searchQuery.length < 2) { setCommunities([]); return; }
    const timeout = setTimeout(async () => {
      setLoadingSearch(true);
      const { data } = await supabase
        .from('public_hoa_directory')
        .select('id, name')
        .ilike('name', `%${searchQuery}%`)
        .limit(10);

      if (data) {
        // Count members per community
        const ids = data.map((h: any) => h.id);
        const { data: memberships } = await supabase
          .from('hoa_memberships')
          .select('hoa_id')
          .in('hoa_id', ids)
          .eq('status', 'approved');

        const counts: Record<string, number> = {};
        (memberships || []).forEach((m: any) => { counts[m.hoa_id] = (counts[m.hoa_id] || 0) + 1; });

        setCommunities(data.map((h: any) => ({
          id: h.id,
          name: h.name,
          address: null,
          memberCount: counts[h.id] || 0,
        })));
      }
      setLoadingSearch(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleJoinByCode = async () => {
    if (!inviteCode.trim() || !currentUser) return;
    setJoiningByCode(true);
    try {
      // Look up HOA by name or code (simple approach: match by name)
      const { data: hoa } = await supabase
        .from('public_hoa_directory')
        .select('id')
        .ilike('name', inviteCode.trim())
        .single();

      if (!hoa) {
        toast({ title: 'Not Found', description: 'No community found with that code', variant: 'destructive' });
        setJoiningByCode(false);
        return;
      }

      await requestJoin(hoa.id);
      setInviteCode('');
    } catch {
      toast({ title: 'Error', description: 'Failed to join community', variant: 'destructive' });
    } finally {
      setJoiningByCode(false);
    }
  };

  const requestJoin = async (hoaId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.rpc('request_hoa_membership', {
        target_hoa_id: hoaId,
      });
      if (error) {
        if (error.message.includes('already exists')) {
          toast({ title: 'Already requested', description: 'You already have a membership for this community' });
        } else {
          throw error;
        }
        return;
      }
      setRequestedIds((prev) => new Set(prev).add(hoaId));
      toast({ title: 'Request sent', description: 'Waiting for admin approval' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to request membership', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F9FAFB' }}>
      {/* Navy Header */}
      <div className="text-white px-5 pt-[50px] pb-5" style={{ background: 'linear-gradient(135deg, #0F1F3D 0%, #0D2137 60%, #1A3350 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <div className="text-xl font-extrabold">Join a Community</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Enter your invite code or search for your community
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Invite Code Card */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <h3 className="text-sm font-extrabold" style={{ color: '#0F1F3D' }}>Have an invite code?</h3>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#4B5563' }}>Invite Code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your invite code"
              className="w-full text-sm"
              style={{
                borderRadius: 10,
                border: '1px solid #E5E7EB',
                padding: '12px 14px',
                outline: 'none',
                fontSize: 14,
                color: '#0F1F3D',
              }}
            />
          </div>
          <button
            onClick={handleJoinByCode}
            disabled={joiningByCode || !inviteCode.trim()}
            className="w-full py-3 rounded-xl text-white text-sm font-extrabold disabled:opacity-50"
            style={{ background: '#00D4FF' }}
          >
            {joiningByCode ? 'Joining...' : 'Join Community'}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: '#E5E7EB' }} />
          <span className="text-xs font-bold" style={{ color: '#9CA3AF' }}>or</span>
          <div className="flex-1 h-px" style={{ background: '#E5E7EB' }} />
        </div>

        {/* Search Card */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <h3 className="text-sm font-extrabold" style={{ color: '#0F1F3D' }}>Search by community name</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search communities..."
              className="w-full text-sm pl-10"
              style={{
                borderRadius: 10,
                border: '1px solid #E5E7EB',
                padding: '12px 14px',
                paddingLeft: 40,
                outline: 'none',
                fontSize: 14,
                color: '#0F1F3D',
              }}
            />
          </div>

          {/* Results */}
          {loadingSearch && (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#00D4FF', borderTopColor: 'transparent' }} />
            </div>
          )}
          {!loadingSearch && communities.length > 0 && (
            <div className="space-y-2">
              {communities.map((c) => {
                const isRequested = requestedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ border: '1px solid #E5E7EB' }}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-bold truncate" style={{ color: '#0F1F3D' }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {c.memberCount} member{c.memberCount !== 1 ? 's' : ''}
                        {c.address ? ` · ${c.address}` : ''}
                      </p>
                    </div>
                    {isRequested ? (
                      <span
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: '#F3F4F6', color: '#9CA3AF' }}
                      >
                        <Check className="h-3 w-3" /> Requested
                      </span>
                    ) : (
                      <button
                        onClick={() => requestJoin(c.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap"
                        style={{ background: '#00D4FF' }}
                      >
                        Request to Join
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!loadingSearch && searchQuery.length >= 2 && communities.length === 0 && (
            <p className="text-center text-xs py-4" style={{ color: '#9CA3AF' }}>
              No communities found matching "{searchQuery}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinCommunity;
