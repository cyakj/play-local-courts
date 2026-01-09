import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WeatherIcon } from './WeatherIcon';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { getZipCoordinates } from '@/lib/zipCodeUtils';
import type { WeatherData, HourlyForecast, DailyForecast } from '@/hooks/useWeather';

interface WeatherForecastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: string | null;
  locationName: string;
}

// Map WMO weather codes to conditions
function mapWeatherCode(code: number): { condition: WeatherData['condition']; description: string } {
  if (code === 0) return { condition: 'sunny', description: 'Clear' };
  if (code === 1) return { condition: 'sunny', description: 'Mainly clear' };
  if (code === 2) return { condition: 'partly_cloudy', description: 'Partly cloudy' };
  if (code === 3) return { condition: 'cloudy', description: 'Overcast' };
  if (code >= 45 && code <= 48) return { condition: 'cloudy', description: 'Foggy' };
  if (code >= 51 && code <= 55) return { condition: 'rainy', description: 'Drizzle' };
  if (code >= 56 && code <= 57) return { condition: 'rainy', description: 'Freezing drizzle' };
  if (code >= 61 && code <= 65) return { condition: 'rainy', description: 'Rain' };
  if (code >= 66 && code <= 67) return { condition: 'rainy', description: 'Freezing rain' };
  if (code >= 71 && code <= 77) return { condition: 'cloudy', description: 'Snow' };
  if (code >= 80 && code <= 82) return { condition: 'rainy', description: 'Showers' };
  if (code >= 85 && code <= 86) return { condition: 'cloudy', description: 'Snow showers' };
  if (code >= 95 && code <= 99) return { condition: 'stormy', description: 'Thunderstorm' };
  return { condition: 'cloudy', description: 'Unknown' };
}

export const WeatherForecastDialog = ({ 
  open, 
  onOpenChange, 
  location,
  locationName 
}: WeatherForecastDialogProps) => {
  const [selectedDay, setSelectedDay] = useState(0);
  const [dailyForecasts, setDailyForecasts] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !location) return;

    const fetchHourlyForecast = async () => {
      try {
        setLoading(true);
        
        // Parse location coordinates
        let lat: number | undefined;
        let lng: number | undefined;

        const zipMatch = location.match(/\b(\d{5})\b/);
        if (zipMatch) {
          const coords = getZipCoordinates(zipMatch[1]);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }

        const prCities: Record<string, { lat: number; lng: number }> = {
          'dorado': { lat: 18.4329, lng: -66.2865 },
          'san juan': { lat: 18.4655, lng: -66.1057 },
          'bayamon': { lat: 18.3985, lng: -66.1640 },
          'carolina': { lat: 18.3870, lng: -65.9640 },
          'ponce': { lat: 18.0108, lng: -66.6141 },
          'caguas': { lat: 18.2341, lng: -66.0352 },
          'mayaguez': { lat: 18.2013, lng: -67.1397 },
          'humacao': { lat: 18.1497, lng: -65.8274 },
          'arecibo': { lat: 18.4500, lng: -66.7156 },
          'guaynabo': { lat: 18.3970, lng: -66.1070 },
        };

        if (!lat || !lng) {
          const locationLower = location.toLowerCase();
          for (const [key, value] of Object.entries(prCities)) {
            if (locationLower.includes(key)) {
              lat = value.lat;
              lng = value.lng;
              break;
            }
          }
        }

        if (!lat || !lng) {
          lat = 18.4655;
          lng = -66.1057;
        }

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America%2FPuerto_Rico&forecast_days=7&temperature_unit=fahrenheit`
        );

        if (!response.ok) throw new Error('Weather fetch failed');

        const data = await response.json();

        // Process into daily forecasts with hourly data
        const forecasts: DailyForecast[] = [];
        
        if (data.daily?.time && data.hourly?.time) {
          data.daily.time.forEach((date: string, dayIndex: number) => {
            const { condition, description } = mapWeatherCode(data.daily.weather_code[dayIndex]);
            
            // Get hourly data for this day
            const hourlyData: HourlyForecast[] = [];
            data.hourly.time.forEach((hourTime: string, hourIndex: number) => {
              if (hourTime.startsWith(date)) {
                const { condition: hourCondition, description: hourDesc } = mapWeatherCode(data.hourly.weather_code[hourIndex]);
                hourlyData.push({
                  time: hourTime,
                  temperature: Math.round(data.hourly.temperature_2m[hourIndex]),
                  condition: hourCondition,
                  description: hourDesc,
                });
              }
            });

            forecasts.push({
              date,
              tempHigh: Math.round(data.daily.temperature_2m_max[dayIndex]),
              tempLow: Math.round(data.daily.temperature_2m_min[dayIndex]),
              condition,
              description,
              hourly: hourlyData,
            });
          });
        }

        setDailyForecasts(forecasts);
      } catch (error) {
        console.error('Error fetching hourly forecast:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHourlyForecast();
  }, [open, location]);

  const selectedForecast = dailyForecasts[selectedDay];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            7-Day Forecast • {locationName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Day selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dailyForecasts.map((day, index) => {
                const date = new Date(day.date + 'T12:00:00');
                const isToday = index === 0;
                
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(index)}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-lg min-w-[72px] transition-colors",
                      selectedDay === index 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <span className="text-xs font-medium">
                      {isToday ? 'Today' : format(date, 'EEE')}
                    </span>
                    <WeatherIcon 
                      condition={day.condition} 
                      className={cn(
                        "h-6 w-6 my-1",
                        selectedDay === index && "text-primary-foreground"
                      )} 
                    />
                    <span className="text-sm font-bold">{day.tempHigh}°</span>
                    <span className={cn(
                      "text-xs",
                      selectedDay === index ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {day.tempLow}°
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hourly forecast */}
            {selectedForecast && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Hourly Forecast
                </h4>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-1 pr-4">
                    {selectedForecast.hourly.map((hour) => {
                      const time = new Date(hour.time);
                      const isNow = Math.abs(time.getTime() - Date.now()) < 30 * 60 * 1000;
                      
                      return (
                        <div
                          key={hour.time}
                          className={cn(
                            "flex items-center justify-between py-2 px-3 rounded-lg",
                            isNow && "bg-primary/10 border border-primary/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-sm w-16",
                              isNow ? "font-bold text-primary" : "text-muted-foreground"
                            )}>
                              {isNow ? 'Now' : format(time, 'h:mm a')}
                            </span>
                            <WeatherIcon condition={hour.condition} className="h-5 w-5" />
                            <span className="text-sm text-muted-foreground">
                              {hour.description}
                            </span>
                          </div>
                          <span className="text-lg font-semibold">{hour.temperature}°</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
