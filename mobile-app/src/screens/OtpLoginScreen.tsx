import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpLogin'>;

export function OtpLoginScreen({ navigation }: Props) {
  const { requestOtp, verifyOtp } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identifier' | 'code'>('identifier');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetOtp() {
    setError(null);
    setLoading(true);
    try {
      const { devCode: dc } = await requestOtp(identifier.trim());
      setDevCode(dc ?? null);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(identifier.trim(), code.trim());
      navigation.replace('Home');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>{step === 'identifier' ? 'Sign in' : 'Enter Code'}</Text>
          <Text style={styles.subtitle}>
            {step === 'identifier'
              ? 'Use the email or phone your WISSEN admin onboarded you with.'
              : `We sent a 6-digit code to ${identifier}.`}
          </Text>

          {step === 'identifier' ? (
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@org.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Email or phone"
            />
          ) : (
            <>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                accessibilityLabel="Enter 6 digit code"
              />
              {devCode ? <Text style={styles.devHint}>Demo mode — your code is {devCode}</Text> : null}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title={step === 'identifier' ? 'Get OTP' : 'Verify & Continue'}
            onPress={step === 'identifier' ? handleGetOtp : handleVerify}
            loading={loading}
            disabled={step === 'identifier' ? identifier.trim().length === 0 : code.trim().length !== 6}
          />
          {step === 'code' ? (
            <PrimaryButton title="Use a different account" variant="secondary" onPress={() => setStep('identifier')} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 18,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24 },
  devHint: { ...typography.caption, color: colors.primary, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.counterfeit, marginBottom: spacing.sm },
});
