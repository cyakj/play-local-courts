import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ViewRecord {
  document_id: string;
  user_id: string;
  viewed_at: string;
}

/** For residents: returns Set of document IDs the current user has viewed */
export function useMyDocumentViews(userId: string | undefined, documentIds: string[]) {
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const refetch = async () => {
    if (!userId || documentIds.length === 0) return;
    const { data } = await supabase
      .from('document_views' as any)
      .select('document_id')
      .eq('user_id', userId)
      .in('document_id', documentIds);
    if (data) {
      setViewedIds(new Set((data as any[]).map(v => v.document_id)));
    }
  };

  useEffect(() => { refetch(); }, [userId, documentIds.join(',')]);

  return { viewedIds, refetch };
}

/** For admins: returns view counts and detailed records per document */
export function useAdminDocumentViews(documentIds: string[]) {
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [viewDetails, setViewDetails] = useState<Record<string, ViewRecord[]>>({});

  const refetch = async () => {
    if (documentIds.length === 0) return;
    const { data } = await supabase
      .from('document_views' as any)
      .select('document_id, user_id, viewed_at')
      .in('document_id', documentIds);
    if (data) {
      const counts: Record<string, number> = {};
      const details: Record<string, ViewRecord[]> = {};
      (data as unknown as ViewRecord[]).forEach(v => {
        counts[v.document_id] = (counts[v.document_id] || 0) + 1;
        if (!details[v.document_id]) details[v.document_id] = [];
        details[v.document_id].push(v);
      });
      setViewCounts(counts);
      setViewDetails(details);
    }
  };

  useEffect(() => { refetch(); }, [documentIds.join(',')]);

  return { viewCounts, viewDetails, refetch };
}
