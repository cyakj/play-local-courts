import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WheelWeatherSource } from '@/components/ui/TimeSlotWheel';
import { getZipCoordinates } from '@/lib/zipCodeUtils';
import { mapWeatherCode, type WeatherData } from '@/hooks/useWeather';

const DEFAULT_COORDINATES = { lat: 18.4655, lng: -66.1057 };

const PR_CITIES: Record<string, { lat: number; lng: number }> = {
  dorado: { lat: 18.4329, lng: -66.2865 },
  'san juan': DEFAULT_COORDINATES,
  bayamon: { lat: 18.3985, lng: -66.164 },
  carolina: { lat: 18.387, lng: -65.964 },
  ponce: { lat: 18.0108, lng: -66.6141 },
  caguas: { lat: 18.2341, lng: -66.0352 },
  mayaguez: { lat: 18.2013, lng: -67.1397 },
  humacao: { lat: 18.1497, lng: -65.8274 },
  arecibo: { lat: 18.45, lng: -66.7156 },
  guaynabo: { lat: 18.397, lng: -66.107 },
};

interface HourlyWeatherData extends WeatherData {
  precipitationProbability: number;
}

function resolveCoordinates(location?: string | null) {
  if (!location) return null;

  const zip = location.match(/\b(\d{5})\b/)?.[1];
  if (zip) {
    const coordinates = getZipCoordinates(zip);
    if (coordinates) return coordinates;
  }

  const normalized = location.toLowerCase();
  const city = Object.entries(PR_CITIES).find(([name]) => normalized.includes(name));
  return city?.[1] ?? DEFAULT_COORDINATES;
}

function weatherKey(date: Date, time: string): string {
  const [hour] = time.slice(0, 5).split(':').map(Number);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:00`;
}

export function useHourlyWeather(location?: string | null) {
  const [weatherByHour, setWeatherByHour] = useState<Record<string, HourlyWeatherData>>({});
  const [hourlyTemp, setHourlyTemp] = useState<number[]>([]);
  const [hourlyRain, setHourlyRain] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const coordinates = useMemo(() => resolveCoordinates(location), [location]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchWeather() {
      if (!coordinates) {
        setWeatherByHour({});
        setHourlyTemp([]);
        setHourlyRain([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}`
          + '&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m'
          + '&timezone=America%2FPuerto_Rico&forecast_days=14&temperature_unit=fahrenheit&wind_speed_unit=mph',
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Weather fetch failed');

        const data = await response.json();
        const next: Record<string, HourlyWeatherData> = {};
        const times: string[] = data.hourly?.time ?? [];
        const temperatures: number[] = data.hourly?.temperature_2m ?? [];
        const codes: number[] = data.hourly?.weather_code ?? [];
        const precipitation: number[] = data.hourly?.precipitation_probability ?? [];
        const wind: number[] = data.hourly?.wind_speed_10m ?? [];

        times.forEach((time, index) => {
          const mapped = mapWeatherCode(codes[index] ?? 3);
          next[time] = {
            temperature: Math.round(temperatures[index] ?? 0),
            condition: mapped.condition,
            description: mapped.description,
            windSpeed: Math.round(wind[index] ?? 0),
            precipitationProbability: Math.round(precipitation[index] ?? 0),
          };
        });

        setWeatherByHour(next);
        setHourlyTemp(temperatures);
        setHourlyRain(precipitation);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setWeatherByHour({});
          setHourlyTemp([]);
          setHourlyRain([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchWeather();
    return () => controller.abort();
  }, [coordinates]);

  const getWeather = useCallback(
    (date: Date, time: string): HourlyWeatherData | null =>
      weatherByHour[weatherKey(date, time)] ?? null,
    [weatherByHour],
  );

  const wheelWeather = useMemo<WheelWeatherSource | null>(() => {
    if (!hourlyTemp.length) return null;
    return {
      tempF: Math.round(hourlyTemp[0] ?? 0),
      rainPct: Math.round(hourlyRain[0] ?? 0),
      hourlyTemp,
      hourlyRain,
    };
  }, [hourlyRain, hourlyTemp]);

  return { wheelWeather, getWeather, loading };
}
