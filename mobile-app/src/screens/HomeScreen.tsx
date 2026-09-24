import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PrimaryButton } from '../components/PrimaryButton';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { useAuth } from '../context/AuthContext';
import { getQueue, watchConnectivityAndSync } from '../services/offlineQueue';
import { colors, spacing, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { user, token, signOut } = useAuth();
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    getQueue().then((q) => setQueuedCount(q.length));
    if (!token) return;
    const unsubscribe = watchConnectivityAndSync(token, () => getQueue().then((q) => setQueuedCount(q.length)));
    return unsubscribe;
  }, [token]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.org ?? 'there'}</Text>
          <Text style={styles.role}>{user?.role}</Text>
        </View>
        <PrimaryButton title="Sign out" variant="secondary" onPress={async () => { await signOut(); navigation.replace('Onboarding'); }} />
      </View>

      <OfflineIndicator queuedCount={queuedCount} />

      <View style={styles.hero}>
        <Text style={styles.title}>Verify Medication Authenticity</Text>
        <Text style={styles.subtitle}>Scan the GS1 Data Matrix or barcode on the pack.</Text>
        <PrimaryButton title="Scan Now" onPress={() => navigation.navigate('Scan', { offlineMode: false })} />
      </View>

      <View style={styles.shortcuts}>
        <PrimaryButton title="History" variant="secondary" onPress={() => navigation.navigate('History')} />
        <PrimaryButton title="Help Center" variant="secondary" onPress={() => navigation.navigate('HelpCenter')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { ...typography.h2, color: colors.textPrimary },
  role: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { ...typography.h1, textAlign: 'center', color: colors.textPrimary },
  subtitle: { ...typography.body, textAlign: 'center', color: colors.textSecondary, marginBottom: spacing.md },
  shortcuts: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
});
