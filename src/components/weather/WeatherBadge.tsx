import React from 'react';
import { WeatherIcon } from './WeatherIcon';
import { cn } from '@/lib/utils';

interface WeatherBadgeProps {
  temperature: number;
  condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';
  className?: string;
  compact?: boolean;
}

export const WeatherBadge = ({ temperature, condition, className, compact = false }: WeatherBadgeProps) => {
  if (compact) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}>
        <WeatherIcon condition={condition} className="h-3.5 w-3.5" />
        <span>{temperature}°F</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-sm",
      className
    )}>
      <WeatherIcon condition={condition} className="h-4 w-4" />
      <span className="font-medium">{temperature}°F</span>
    </div>
  );
};
