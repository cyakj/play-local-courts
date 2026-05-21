import React, { useState } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { WeatherIcon } from './WeatherIcon';
import { WeatherForecastDialog } from './WeatherForecastDialog';
import { Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherPillProps {
  location?: string | null;
  className?: string;
}

export const WeatherPill = ({ location, className }: WeatherPillProps) => {
  const { weather, loading, locationName } = useWeather(location);
  const [forecastOpen, setForecastOpen] = useState(false);

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted animate-pulse",
        className
      )}>
        <div className="w-4 h-4 bg-muted-foreground/20 rounded-full" />
        <div className="w-10 h-4 bg-muted-foreground/20 rounded" />
      </div>
    );
  }

  if (!weather || !location) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setForecastOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all cursor-pointer hover:bg-muted",
          className
        )}
      >
        <WeatherIcon condition={weather.condition} className="h-4 w-4" />
        <span className="text-sm font-medium">{weather.temperature}°F</span>
        {weather.humidity !== undefined && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Droplets className="h-3 w-3 text-blue-400" />
            {weather.humidity}%
          </span>
        )}
      </button>

      <WeatherForecastDialog
        open={forecastOpen}
        onOpenChange={setForecastOpen}
        location={location}
        locationName={locationName}
      />
    </>
  );
};
