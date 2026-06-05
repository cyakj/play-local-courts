import { StyleSheet, Text, View } from 'react-native';
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow, Zap } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';

interface WeatherMiniProps {
  temperature: number;
  condition: WeatherCondition;
  description: string;
  windSpeed?: number;
}

function WeatherIcon({ condition, size = 20 }: { condition: WeatherCondition; size?: number }) {
  const props = { size, color: '#F5A623', strokeWidth: 1.5 };
  switch (condition) {
    case 'sunny':         return <Sun {...props} />;
    case 'partly_cloudy': return <CloudSun {...props} />;
    case 'cloudy':        return <Cloud {...{ ...props, color: '#9AA3B8' }} />;
    case 'rainy':         return <CloudRain {...{ ...props, color: '#5B8CFF' }} />;
    case 'stormy':        return <Zap {...{ ...props, color: Colors.negative }} />;
    default:              return <Cloud {...{ ...props, color: '#9AA3B8' }} />;
  }
}

export function WeatherMini({ temperature, condition, description, windSpeed }: WeatherMiniProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <WeatherIcon condition={condition} size={20} />
      <Text style={[styles.temp, { color: theme.textPrimary }]}>{temperature}°F</Text>
      <Text style={[styles.desc, { color: theme.textMuted }]} numberOfLines={1}>{description}</Text>
      {windSpeed != null && (
        <Text style={[styles.wind, { color: theme.textMuted }]}>Wind {windSpeed} mph</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
    minWidth: 76,
  },
  temp: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 15,
    lineHeight: 19,
  },
  desc: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.eyebrow,
    textAlign: 'center',
  },
  wind: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.eyebrow,
    textAlign: 'center',
  },
});
