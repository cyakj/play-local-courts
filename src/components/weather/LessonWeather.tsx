import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { useHourlyWeather } from '@/hooks/useHourlyWeather';
import { WeatherMini } from '@/components/ui/WeatherMini';

export function LessonWeather({
  date,
  time,
  location,
}: {
  date: string;
  time: string;
  location?: string | null;
}) {
  const { theme } = useTheme();
  const lessonDate = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const { getWeather, loading } = useHourlyWeather(location);
  const weather = getWeather(lessonDate, time);

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.textMuted }]}>WEATHER</Text>
      {!location || (!loading && !weather) ? (
        <Text style={[styles.unavailable, { color: theme.textSecondary }]}>
          Weather unavailable
        </Text>
      ) : weather ? (
        <WeatherMini
          temperature={weather.temperature}
          condition={weather.condition}
          description={weather.description}
          windSpeed={weather.windSpeed}
        />
      ) : (
        <View style={[styles.skeleton, { backgroundColor: theme.bgElevated }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  label: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    letterSpacing: 1.1,
  },
  unavailable: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
  },
  skeleton: {
    height: 76,
    borderRadius: 10,
    opacity: 0.7,
  },
});
