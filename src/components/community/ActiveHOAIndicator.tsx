import React from 'react';
import { Building2 } from 'lucide-react';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { cn } from '@/lib/utils';

interface ActiveHOAIndicatorProps {
  className?: string;
  compact?: boolean;
}

export const ActiveHOAIndicator = ({ className, compact = false }: ActiveHOAIndicatorProps) => {
  const { activeHOA, isHOAUser } = useActiveHOA();

  if (!isHOAUser || !activeHOA) return null;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}>
        <Building2 className="h-3 w-3" />
        <span className="truncate max-w-[120px]">{activeHOA.hoaName}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100",
      className
    )}>
      <Building2 className="h-4 w-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-800 truncate max-w-[150px]">
        {activeHOA.hoaName}
      </span>
    </div>
  );
};
