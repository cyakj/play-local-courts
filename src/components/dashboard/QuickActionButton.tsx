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
      className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border/60 hover:border-primary/20 hover:shadow-md active:scale-95 transition-all duration-150 group"
    >
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm",
        iconBgColor
      )}>
        {icon}
      </div>
      <div className="text-center">
        <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 hidden sm:block">{subtitle}</div>
      </div>
    </Link>
  );
};
