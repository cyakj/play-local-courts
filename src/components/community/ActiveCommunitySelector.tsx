import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Check, Plus, Shield, MapPin } from 'lucide-react';
import { useActiveHOA, HOAMembership } from '@/contexts/ActiveHOAContext';

interface ActiveCommunitySelectorProps {
  onAddCommunity: () => void;
}

export const ActiveCommunitySelector = ({ onAddCommunity }: ActiveCommunitySelectorProps) => {
  const { activeHOA, memberships, setActiveHOA, hasMultipleHOAs } = useActiveHOA();

  if (memberships.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Active Community</span>
        </div>
        <Button
          onClick={onAddCommunity}
          variant="outline"
          className="w-full justify-start gap-2 h-auto py-3 border-dashed"
        >
          <Plus className="h-4 w-4" />
          <span>Add Community</span>
        </Button>
      </div>
    );
  }

  // Single HOA - show as label without dropdown
  if (!hasMultipleHOAs && activeHOA) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Active Community</span>
          <Badge variant="secondary" className="text-xs">
            {activeHOA.role === 'admin' ? 'Admin' : 'Member'}
          </Badge>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{activeHOA.hoaName}</p>
            {activeHOA.hoaAddress && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {activeHOA.hoaAddress}
              </p>
            )}
          </div>
          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
        </div>
        <Button
          onClick={onAddCommunity}
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>Add Another Community</span>
        </Button>
      </div>
    );
  }

  // Multiple HOAs - show dropdown
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Active Community</span>
        {activeHOA && (
          <Badge variant="secondary" className="text-xs">
            {activeHOA.role === 'admin' ? 'Admin' : 'Member'}
          </Badge>
        )}
      </div>
      <Select
        value={activeHOA?.hoaId || ''}
        onValueChange={(value) => {
          if (value === 'add-new') {
            onAddCommunity();
          } else {
            setActiveHOA(value);
          }
        }}
      >
        <SelectTrigger className="w-full h-auto py-3">
          <SelectValue placeholder="Select a community">
            {activeHOA && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="truncate">{activeHOA.hoaName}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-50">
          {memberships.map((membership) => (
            <SelectItem key={membership.hoaId} value={membership.hoaId}>
              <div className="flex items-center gap-2 py-1">
                <Building2 className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">{membership.hoaName}</p>
                  {membership.hoaAddress && (
                    <p className="text-xs text-muted-foreground">{membership.hoaAddress}</p>
                  )}
                </div>
                {membership.role === 'admin' && (
                  <Shield className="h-4 w-4 text-amber-600" />
                )}
              </div>
            </SelectItem>
          ))}
          <div className="border-t my-1" />
          <SelectItem value="add-new" className="text-blue-600">
            <div className="flex items-center gap-2 py-1">
              <Plus className="h-4 w-4" />
              <span>Add Community</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
