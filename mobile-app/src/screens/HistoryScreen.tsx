import React, { useCallback, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { getQueue, syncQueue } from '../services/offlineQueue';
import type { QueuedScan } from '../services/types';
import { colors, spacing, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen(_props: Props) {
  const { token } = useAuth();
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    getQueue().then(setQueue);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleSyncNow() {
    if (!token) return;
    setSyncing(true);
    try {
      await syncQueue(token);
    } finally {
      setSyncing(false);
      refresh();
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        {queue.length > 0 ? <PrimaryButton title="Sync Now" onPress={handleSyncNow} loading={syncing} /> : null}
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item, idx) => `${item.gtin}-${item.serial}-${idx}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No queued scans — everything is synced.</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>GTIN {item.gtin} · Serial {item.serial}</Text>
            <Text style={styles.itemMeta}>Queued {new Date(item.queuedAt).toLocaleString()}</Text>
            <Text style={styles.pendingTag}>Pending sync</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.h1, color: colors.textPrimary },
  list: { gap: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  item: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  itemTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  itemMeta: { ...typography.caption, color: colors.textSecondary },
  pendingTag: { ...typography.caption, color: colors.offline, fontWeight: '700' },
});
