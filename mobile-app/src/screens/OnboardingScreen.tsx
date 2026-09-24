import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>MA</Text>
        </View>
        <Text style={styles.title}>Verify Medicines, Protect Lives</Text>
        <Text style={styles.body}>
          Scan a medication's GS1 barcode to confirm authenticity in under a second — backed by a
          permissioned blockchain ledger and zero on-chain personal data.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton title="Get Started" onPress={() => navigation.navigate('OtpLogin')} />
        <PrimaryButton
          title="Scan Without Internet"
          variant="secondary"
          onPress={() => navigation.navigate('Scan', { offlineMode: true })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between', padding: spacing.lg },
  hero: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.md },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  title: { ...typography.h1, textAlign: 'center', color: colors.textPrimary },
  body: { ...typography.body, textAlign: 'center', color: colors.textSecondary, paddingHorizontal: spacing.md },
  actions: { gap: spacing.md, marginBottom: spacing.lg },
});
