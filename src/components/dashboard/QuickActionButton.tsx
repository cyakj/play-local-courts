import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickActionButtonProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
  iconBgColor?: string;
}

export const QuickActionButton = ({ 
  icon, 
  title, 
  subtitle, 
  to, 
  iconBgColor = 'bg-primary' 
}: QuickActionButtonProps) => {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all group"
    >
      <div className={cn(
        "flex-shrink-0 p-2.5 rounded-lg text-white",
        iconBgColor
      )}>
        {icon}
      </div>
      <div>
        <div className="font-medium text-sm group-hover:text-primary transition-colors">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  );
};
