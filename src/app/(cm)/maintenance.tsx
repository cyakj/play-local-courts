import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { AdminHeader, AdminScreen } from '@/components/admin/kit';
import { ReportsPanel, useAdminReports } from '@/components/admin/ReportsPanel';

// Global Issues tab: every report across the communities this admin manages. Access is
// enforced by RLS on maintenance_reports/hoas — the community chips are only a filter.
export default function IssuesScreen() {
  const { reportId, status } = useLocalSearchParams<{ reportId?: string; status?: string }>();
  const { reports, communities, loading, error, reload } = useAdminReports();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('maintenance_reports_cm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_reports' }, () => { reload(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  return (
    <AdminScreen
      testID="admin-issues"
      header={<AdminHeader title="Issues" />}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }}>
      <ReportsPanel
        reports={reports}
        communities={communities}
        loading={loading}
        error={error}
        reload={reload}
        showCommunityFilter
        initialStatus={status ?? 'open'}
        openReportId={reportId}
      />
    </AdminScreen>
  );
}
