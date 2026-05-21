import React from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, CloudSun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherIconProps {
  condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';
  className?: string;
}

export const WeatherIcon = ({ condition, className }: WeatherIconProps) => {
  const iconClass = cn('h-5 w-5', className);
  
  switch (condition) {
    case 'sunny':
      return <Sun className={cn(iconClass, 'text-yellow-500')} />;
    case 'partly_cloudy':
      return <CloudSun className={cn(iconClass, 'text-yellow-400')} />;
    case 'cloudy':
      return <Cloud className={cn(iconClass, 'text-gray-400')} />;
    case 'rainy':
      return <CloudRain className={cn(iconClass, 'text-blue-400')} />;
    case 'stormy':
      return <CloudLightning className={cn(iconClass, 'text-purple-500')} />;
    default:
      return <Cloud className={iconClass} />;
  }
};
