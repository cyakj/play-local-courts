import { useState, useEffect } from 'react';
import { getZipCoordinates } from '@/lib/zipCodeUtils';

export interface WeatherData {
  temperature: number;
  condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';
  description: string;
  humidity?: number;
  windSpeed?: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  condition: WeatherData['condition'];
  description: string;
}

export interface DailyForecast {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: WeatherData['condition'];
  description: string;
  hourly: HourlyForecast[];
}

export interface WeatherForecast {
  [date: string]: WeatherData;
}

// Map WMO weather codes to our simplified conditions
// https://open-meteo.com/en/docs#weathervariables
function mapWeatherCode(code: number): { condition: WeatherData['condition']; description: string } {
  if (code === 0) return { condition: 'sunny', description: 'Clear sky' };
  if (code === 1) return { condition: 'sunny', description: 'Mainly clear' };
  if (code === 2) return { condition: 'partly_cloudy', description: 'Partly cloudy' };
  if (code === 3) return { condition: 'cloudy', description: 'Overcast' };
  if (code >= 45 && code <= 48) return { condition: 'cloudy', description: 'Foggy' };
  if (code >= 51 && code <= 55) return { condition: 'rainy', description: 'Drizzle' };
  if (code >= 56 && code <= 57) return { condition: 'rainy', description: 'Freezing drizzle' };
  if (code >= 61 && code <= 65) return { condition: 'rainy', description: 'Rain' };
  if (code >= 66 && code <= 67) return { condition: 'rainy', description: 'Freezing rain' };
  if (code >= 71 && code <= 77) return { condition: 'cloudy', description: 'Snow' };
  if (code >= 80 && code <= 82) return { condition: 'rainy', description: 'Rain showers' };
  if (code >= 85 && code <= 86) return { condition: 'cloudy', description: 'Snow showers' };
  if (code >= 95 && code <= 99) return { condition: 'stormy', description: 'Thunderstorm' };
  return { condition: 'cloudy', description: 'Unknown' };
}

export function useWeather(location?: string | null) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast>({});
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState<string>('');

  useEffect(() => {
    if (!location) {
      setLoading(false);
      return;
    }

    const fetchWeather = async () => {
      try {
        setLoading(true);
        
        // Parse location - could be a city name or ZIP code
        let lat: number | undefined;
        let lng: number | undefined;
        let displayName = location;

        // Try to extract ZIP code from location
        const zipMatch = location.match(/\b(\d{5})\b/);
        if (zipMatch) {
          const coords = getZipCoordinates(zipMatch[1]);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }

        // Try known Puerto Rico cities
        const prCities: Record<string, { lat: number; lng: number; name: string }> = {
          'dorado': { lat: 18.4329, lng: -66.2865, name: 'Dorado' },
          'san juan': { lat: 18.4655, lng: -66.1057, name: 'San Juan' },
          'bayamon': { lat: 18.3985, lng: -66.1640, name: 'Bayamón' },
          'carolina': { lat: 18.3870, lng: -65.9640, name: 'Carolina' },
          'ponce': { lat: 18.0108, lng: -66.6141, name: 'Ponce' },
          'caguas': { lat: 18.2341, lng: -66.0352, name: 'Caguas' },
          'mayaguez': { lat: 18.2013, lng: -67.1397, name: 'Mayagüez' },
          'humacao': { lat: 18.1497, lng: -65.8274, name: 'Humacao' },
          'arecibo': { lat: 18.4500, lng: -66.7156, name: 'Arecibo' },
          'guaynabo': { lat: 18.3970, lng: -66.1070, name: 'Guaynabo' },
        };

        if (!lat || !lng) {
          const locationLower = location.toLowerCase();
          for (const [key, value] of Object.entries(prCities)) {
            if (locationLower.includes(key)) {
              lat = value.lat;
              lng = value.lng;
              displayName = value.name;
              break;
            }
          }
        }

        // Default to San Juan if no coordinates found
        if (!lat || !lng) {
          lat = 18.4655;
          lng = -66.1057;
          displayName = location;
        }

        setLocationName(displayName);

        // Fetch weather from Open-Meteo
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,weather_code&timezone=America%2FPuerto_Rico&forecast_days=14&temperature_unit=fahrenheit`
        );

        if (!response.ok) throw new Error('Weather fetch failed');

        const data = await response.json();

        // Parse current weather
        const { condition, description } = mapWeatherCode(data.current.weather_code);
        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          condition,
          description,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
        });

        // Parse forecast
        const forecastData: WeatherForecast = {};
        if (data.daily?.time) {
          data.daily.time.forEach((date: string, index: number) => {
            const { condition, description } = mapWeatherCode(data.daily.weather_code[index]);
            forecastData[date] = {
              temperature: Math.round(data.daily.temperature_2m_max[index]),
              condition,
              description,
            };
          });
        }
        setForecast(forecastData);
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [location]);

  return { weather, forecast, loading, locationName };
}

export function getWeatherForDate(forecast: WeatherForecast, date: string): WeatherData | null {
  return forecast[date] || null;
}
