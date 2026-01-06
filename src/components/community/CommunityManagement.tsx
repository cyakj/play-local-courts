import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { ActiveCommunitySelector } from './ActiveCommunitySelector';
import { PendingMemberships } from './PendingMemberships';
import { AddCommunityFlow } from './AddCommunityFlow';

const CommunityManagement = () => {
  const { memberships, pendingMemberships, loading } = useActiveHOA();
  const [showAddCommunity, setShowAddCommunity] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-blue-600" />
          Community Management
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Active Community Selector */}
        <ActiveCommunitySelector onAddCommunity={() => setShowAddCommunity(true)} />

        {/* Pending Memberships */}
        {pendingMemberships.length > 0 && (
          <PendingMemberships />
        )}

        {/* Add Community Flow */}
        {showAddCommunity && (
          <AddCommunityFlow onClose={() => setShowAddCommunity(false)} />
        )}

        {/* Empty State */}
        {memberships.length === 0 && pendingMemberships.length === 0 && !showAddCommunity && (
          <div className="text-center py-6 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No community memberships yet</p>
            <p className="text-sm mt-1">Join or create a community to access HOA features</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CommunityManagement;
