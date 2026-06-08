import { ScrollView, StyleSheet, View } from 'react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';

export default function CoachScheduleScreen() {
  const { theme } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />
      <ScrollView contentContainerStyle={styles.content} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
});
