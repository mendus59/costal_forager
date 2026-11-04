/**
 * Email sign-in with a one-time code. No password: Supabase emails a 6-digit
 * code (the project's "Magic Link" email template must include {{ .Token }}).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tint = useThemeColor('tint');
  const border = useThemeColor('border');
  const text = useThemeColor('text');
  const muted = useThemeColor('muted');

  const sendCode = async () => {
    const addr = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) return setError(e.message);
    setSentTo(addr);
  };

  const verify = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
    setBusy(false);
    if (e) return setError(e.message);
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const input = [styles.input, { borderColor: border, color: text }];
  const button = (label: string, onPress: () => void, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.button, { backgroundColor: tint, opacity: disabled || busy ? 0.5 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={styles.page}>
        <View card style={{ gap: 10 }}>
          <Text style={styles.h2}>{sentTo ? 'Check your email' : 'Sign in'}</Text>
          <Text muted style={styles.help}>
            {sentTo
              ? `We sent a 6-digit code to ${sentTo}. Enter it below.`
              : 'Sign in to keep your favorites and settings on every device and to get morning alerts for good days.'}
          </Text>
          {sentTo ? (
            <>
              <TextInput
                style={[input, styles.code]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder="123456"
                placeholderTextColor={muted}
                autoFocus
                onSubmitEditing={verify}
              />
              {button('Sign in', verify, code.trim().length < 6)}
              <Pressable onPress={() => (setSentTo(null), setCode(''))} accessibilityRole="button">
                <Text style={{ color: tint, textAlign: 'center' }}>Use a different email</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor={muted}
                autoFocus
                onSubmitEditing={sendCode}
              />
              {button('Email me a code', sendCode, !email.trim())}
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16 },
  h2: { fontSize: 20, fontWeight: '700' },
  help: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', fontSize: 14 },
});
