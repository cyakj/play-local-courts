import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';

import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { UNSAVED_COPY } from '@/lib/unsavedChanges';

interface Options {
  /** True only when the form differs from what is persisted. */
  dirty: boolean;
  /** Persist the form. Resolve true on success; false keeps the user on the screen. Must NOT navigate. */
  save: () => Promise<boolean>;
  /** Restore the last saved state (called before leaving on Discard). */
  discard: () => void;
}

/**
 * Intercepts every way of leaving the screen (header back, iOS swipe-back, Android back,
 * programmatic router calls) while the form is dirty and asks Save / Discard / Keep Editing.
 * iOS/Android use the native alert; web renders an equivalent modal (returned as `dialog`).
 *
 * After a successful explicit save, call `allowNavigation()` immediately before the
 * deliberate `router.back()` so the guard does not prompt a second time.
 */
export function useUnsavedChangesGuard({ dirty, save, discard }: Options) {
  const [webVisible, setWebVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveRef = useRef(save);
  const discardRef = useRef(discard);
  saveRef.current = save;
  discardRef.current = discard;

  // `repeat` re-dispatches the blocked navigation action after turning prevention off.
  const pendingRepeat = useRef<(() => void) | null>(null);
  const disablePreventionRef = useRef<() => void>(() => {});

  const proceed = useCallback(() => {
    const repeat = pendingRepeat.current;
    pendingRepeat.current = null;
    if (repeat) repeat();
    else {
      disablePreventionRef.current();
      if (router.canGoBack()) router.back();
    }
  }, []);

  const onKeep = useCallback(() => {
    pendingRepeat.current = null;
    setWebVisible(false);
  }, []);

  const onDiscard = useCallback(() => {
    discardRef.current();
    setWebVisible(false);
    proceed();
  }, [proceed]);

  const onSave = useCallback(async () => {
    setBusy(true);
    const ok = await saveRef.current();
    setBusy(false);
    if (ok) {
      setWebVisible(false);
      proceed();
    } else {
      // The save handler has already told the user why; stay on the screen.
      pendingRepeat.current = null;
      setWebVisible(false);
    }
  }, [proceed]);

  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    pendingRepeat.current = repeat;
    if (Platform.OS === 'web') {
      setWebVisible(true);
    } else {
      Alert.alert(UNSAVED_COPY.title, UNSAVED_COPY.message, [
        { text: UNSAVED_COPY.save, onPress: onSave },
        { text: UNSAVED_COPY.discard, style: 'destructive', onPress: onDiscard },
        { text: UNSAVED_COPY.keep, style: 'cancel', onPress: onKeep },
      ], { cancelable: true, onDismiss: onKeep });
    }
  });
  disablePreventionRef.current = disablePrevention;

  const allowNavigation = disablePrevention;

  const dialog = Platform.OS === 'web' ? (
    <Modal visible={webVisible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.backdrop}>
        <View testID="unsaved-dialog" style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{UNSAVED_COPY.title}</Text>
          <Text style={styles.message}>{UNSAVED_COPY.message}</Text>
          <TouchableOpacity testID="unsaved-save" style={[styles.btn, styles.primary]} onPress={onSave} disabled={busy}>
            {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>{UNSAVED_COPY.save}</Text>}
          </TouchableOpacity>
          <TouchableOpacity testID="unsaved-discard" style={[styles.btn, styles.destructive]} onPress={onDiscard} disabled={busy}>
            <Text style={styles.destructiveText}>{UNSAVED_COPY.discard}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="unsaved-keep" style={[styles.btn, styles.secondary]} onPress={onKeep} disabled={busy}>
            <Text style={styles.secondaryText}>{UNSAVED_COPY.keep}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : null;

  return { dialog, allowNavigation };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,10,17,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 360, borderRadius: Radius.lg, padding: 22, gap: 10,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: Colors.white },
  message: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: Colors.fg2, marginBottom: 6, lineHeight: 22 },
  btn: { minHeight: 48, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.blue },
  primaryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.white },
  destructive: { borderWidth: 1, borderColor: 'rgba(255,92,107,0.45)', backgroundColor: 'rgba(255,92,107,0.10)' },
  destructiveText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.negative },
  secondary: { borderWidth: 1, borderColor: Colors.border },
  secondaryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.fg2 },
});
