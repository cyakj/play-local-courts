import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface HOAMembership {
  id: string;
  hoaId: string;
  hoaName: string;
  hoaAddress?: string;
  role: 'resident' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  isPrimary: boolean;
  lastActiveAt?: string;
  createdAt: string;
}

interface ActiveHOAContextType {
  activeHOA: HOAMembership | null;
  memberships: HOAMembership[];
  pendingMemberships: HOAMembership[];
  loading: boolean;
  setActiveHOA: (hoaId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  requestJoinHOA: (hoaId: string, message?: string) => Promise<void>;
  cancelJoinRequest: (membershipId: string) => Promise<void>;
  hasMultipleHOAs: boolean;
  isHOAUser: boolean;
}

const ActiveHOAContext = createContext<ActiveHOAContextType | undefined>(undefined);

const ACTIVE_HOA_KEY = 'rallynet_active_hoa';

export function ActiveHOAProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [activeHOA, setActiveHOAState] = useState<HOAMembership | null>(null);
  const [memberships, setMemberships] = useState<HOAMembership[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<HOAMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const transformMembership = (row: any): HOAMembership => ({
    id: row.id,
    hoaId: row.hoa_id,
    hoaName: row.hoas?.name || 'Unknown Community',
    hoaAddress: row.hoas?.address,
    role: row.role,
    status: row.status,
    isPrimary: row.is_primary,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
  });

  const fetchMemberships = useCallback(async () => {
    if (!currentUser?.id) {
      setMemberships([]);
      setPendingMemberships([]);
      setActiveHOAState(null);
      setLoading(false);
      return;
    }

    try {
      // First try to get memberships from hoa_memberships table
      const { data: membershipData, error: membershipError } = await supabase
        .from('hoa_memberships')
        .select('id, hoa_id, role, status, is_primary, last_active_at, created_at')
        .eq('user_id', currentUser.id)
        .order('last_active_at', { ascending: false, nullsFirst: false });

      let all: HOAMembership[] = [];

      if (!membershipError && membershipData && membershipData.length > 0) {
        // Fetch HOA details separately to avoid join issues
        const hoaIds = [...new Set(membershipData.map(m => m.hoa_id))];
        const { data: hoaData } = await supabase
          .from('hoas')
          .select('id, name, address')
          .in('id', hoaIds);

        const hoaMap = new Map((hoaData || []).map(h => [h.id, h]));

        all = membershipData.map(row => ({
          id: row.id,
          hoaId: row.hoa_id,
          hoaName: hoaMap.get(row.hoa_id)?.name || 'Unknown Community',
          hoaAddress: hoaMap.get(row.hoa_id)?.address,
          role: row.role as 'resident' | 'admin',
          status: row.status as 'pending' | 'approved' | 'rejected',
          isPrimary: row.is_primary,
          lastActiveAt: row.last_active_at,
          createdAt: row.created_at,
        }));
      } else {
        // Fallback: Check user's profile for hoa_id (legacy support)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('hoa_id, hoa_role, hoa_status')
          .eq('id', currentUser.id)
          .single();

        if (profileData?.hoa_id && profileData.hoa_status === 'approved') {
          const { data: hoaData } = await supabase
            .from('hoas')
            .select('id, name, address')
            .eq('id', profileData.hoa_id)
            .single();

          if (hoaData) {
            all = [{
              id: `profile-${currentUser.id}`,
              hoaId: profileData.hoa_id,
              hoaName: hoaData.name,
              hoaAddress: hoaData.address,
              role: profileData.hoa_role === 'admin' ? 'admin' : 'resident',
              status: 'approved',
              isPrimary: true,
              createdAt: new Date().toISOString(),
            }];
          }
        }
      }

      const approved = all.filter(m => m.status === 'approved');
      const pending = all.filter(m => m.status === 'pending');

      setMemberships(approved);
      setPendingMemberships(pending);

      // Determine active HOA
      const storedHOAId = localStorage.getItem(ACTIVE_HOA_KEY);
      let active: HOAMembership | null = null;

      if (storedHOAId) {
        active = approved.find(m => m.hoaId === storedHOAId) || null;
      }

      if (!active && approved.length > 0) {
        // Find primary or most recently active
        active = approved.find(m => m.isPrimary) || approved[0];
      }

      setActiveHOAState(active);

      if (active) {
        localStorage.setItem(ACTIVE_HOA_KEY, active.hoaId);
      }
    } catch (error) {
      console.error('Error fetching HOA memberships:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  // Real-time subscription for membership changes
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel('hoa_memberships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hoa_memberships',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          fetchMemberships();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, fetchMemberships]);

  const setActiveHOA = async (hoaId: string) => {
    const membership = memberships.find(m => m.hoaId === hoaId);
    if (!membership) {
      toast.error('You do not have access to this community');
      return;
    }

    try {
      const { error } = await supabase.rpc('set_active_hoa', { target_hoa_id: hoaId });
      if (error) throw error;

      setActiveHOAState(membership);
      localStorage.setItem(ACTIVE_HOA_KEY, hoaId);
      toast.success(`Switched to ${membership.hoaName}`);
    } catch (error) {
      console.error('Error setting active HOA:', error);
      toast.error('Failed to switch community');
    }
  };

  const requestJoinHOA = async (hoaId: string, message?: string) => {
    try {
      const { error } = await supabase.rpc('request_hoa_membership', {
        target_hoa_id: hoaId,
        join_message: message || null,
      });

      if (error) throw error;

      toast.success('Join request submitted! Waiting for admin approval.');
      await fetchMemberships();
    } catch (error: any) {
      console.error('Error requesting HOA membership:', error);
      if (error.message?.includes('already exists')) {
        toast.error('You already have a membership request for this community');
      } else {
        toast.error('Failed to submit join request');
      }
    }
  };

  const cancelJoinRequest = async (membershipId: string) => {
    try {
      const { error } = await supabase
        .from('hoa_memberships')
        .delete()
        .eq('id', membershipId)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success('Join request cancelled');
      await fetchMemberships();
    } catch (error) {
      console.error('Error cancelling join request:', error);
      toast.error('Failed to cancel request');
    }
  };

  const value: ActiveHOAContextType = {
    activeHOA,
    memberships,
    pendingMemberships,
    loading,
    setActiveHOA,
    refreshMemberships: fetchMemberships,
    requestJoinHOA,
    cancelJoinRequest,
    hasMultipleHOAs: memberships.length > 1,
    isHOAUser: memberships.length > 0 || pendingMemberships.length > 0,
  };

  return (
    <ActiveHOAContext.Provider value={value}>
      {children}
    </ActiveHOAContext.Provider>
  );
}

export function useActiveHOA() {
  const context = useContext(ActiveHOAContext);
  if (context === undefined) {
    throw new Error('useActiveHOA must be used within an ActiveHOAProvider');
  }
  return context;
}
