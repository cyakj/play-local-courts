import React from 'react';
import { useWeather } from '@/hooks/useWeather';
import { WeatherIcon } from './WeatherIcon';
import { Droplets, Wind, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherBannerProps {
  location?: string | null;
  className?: string;
}

export const WeatherBanner = ({ location, className }: WeatherBannerProps) => {
  const { weather, loading, locationName } = useWeather(location);

  if (loading) {
    return (
      <div className={cn(
        "rounded-2xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-4 animate-pulse",
        className
      )}>
        <div className="h-16 bg-muted/50 rounded-lg" />
      </div>
    );
  }

  if (!weather || !location) {
    return null;
  }

  // Get background gradient based on condition
  const getGradient = () => {
    switch (weather.condition) {
      case 'sunny':
        return 'from-yellow-400/20 via-orange-400/10 to-blue-400/20';
      case 'partly_cloudy':
        return 'from-yellow-300/15 via-gray-300/10 to-blue-300/20';
      case 'cloudy':
        return 'from-gray-400/20 via-gray-300/15 to-gray-400/20';
      case 'rainy':
        return 'from-blue-500/20 via-blue-400/15 to-gray-400/20';
      case 'stormy':
        return 'from-purple-500/20 via-blue-500/15 to-gray-500/20';
      default:
        return 'from-blue-400/20 to-cyan-400/20';
    }
  };

  return (
    <div className={cn(
      "rounded-2xl bg-gradient-to-r p-4 border border-primary/10 shadow-sm overflow-hidden relative",
      getGradient(),
      className
    )}>
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/5 rounded-full" />
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/5 rounded-full" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/50 rounded-xl shadow-sm">
            <WeatherIcon condition={weather.condition} className="h-10 w-10" />
          </div>
          
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-0.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>{locationName}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{weather.temperature}°</span>
              <span className="text-lg text-muted-foreground">F</span>
            </div>
            <div className="text-sm text-muted-foreground">{weather.description}</div>
          </div>
        </div>
        
        <div className="hidden sm:flex flex-col gap-2 text-sm text-muted-foreground">
          {weather.humidity !== undefined && (
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-400" />
              <span>{weather.humidity}% humidity</span>
            </div>
          )}
          {weather.windSpeed !== undefined && (
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-gray-400" />
              <span>{weather.windSpeed} mph wind</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
