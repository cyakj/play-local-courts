import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * react-native-web's Alert.alert() is a total no-op stub
 * (node_modules/react-native-web/dist/exports/Alert: `static alert() {}`).
 * Every Alert.alert() call — confirmations and error/success messages alike —
 * silently does nothing on web. Route through window.confirm/alert there;
 * keep the real Alert.alert on native.
 */
export function platformAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as any);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const confirmBtn = buttons.find((b) => b.style === 'destructive') ?? buttons[buttons.length - 1];
  const cancelBtn = buttons.find((b) => b.style === 'cancel');

  if (window.confirm(text)) {
    confirmBtn.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
