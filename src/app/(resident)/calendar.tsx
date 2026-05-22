import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/constants/design';

export default function ResidentCalendarScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Calendar — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textMuted },
});
