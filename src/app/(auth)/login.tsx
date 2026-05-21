import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
    } else {
      router.replace('/(cm)');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>TenisX</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={Colors.textPlaceholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.textPlaceholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBg,
    paddingHorizontal: Spacing.pagePx,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 32,
    color: Colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: 14,
    fontSize: 14,
    fontFamily: FontFamily.interRegular,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBg,
    minHeight: Spacing.tapTarget,
  },
  button: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.button,
    padding: 14,
    alignItems: 'center',
    minHeight: Spacing.tapTarget,
  },
  buttonText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 14,
    color: Colors.white,
  },
});
