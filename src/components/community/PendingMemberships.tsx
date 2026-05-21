import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Clock, X, MapPin } from 'lucide-react';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';

export const PendingMemberships = () => {
  const { pendingMemberships, cancelJoinRequest } = useActiveHOA();

  if (pendingMemberships.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-muted-foreground">Pending Requests</span>
        <Badge variant="secondary" className="text-xs">{pendingMemberships.length}</Badge>
      </div>
      <div className="space-y-2">
        {pendingMemberships.map((membership) => (
          <div
            key={membership.id}
            className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100"
          >
            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Building2 className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{membership.hoaName}</p>
              {membership.hoaAddress && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {membership.hoaAddress}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1">Awaiting admin approval</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => cancelJoinRequest(membership.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
