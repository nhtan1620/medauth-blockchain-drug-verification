import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, spacing, typography } from '../theme/colors';

/**
 * Always-visible "Offline Mode Active" pill. Prototype testing (Section
 * 14.9 of the project doc) found the previous offline indicator was too
 * subtle — this component is deliberately persistent, not a toast.
 */
export function OfflineIndicator({ queuedCount = 0 }: { queuedCount?: number }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.pill} accessibilityLiveRegion="polite">
      <View style={styles.dot} />
      <Text style={styles.text}>
        Offline Mode Active{queuedCount > 0 ? ` · ${queuedCount} scan${queuedCount === 1 ? '' : 's'} queued` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.offlineBg,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.offline },
  text: { ...typography.caption, color: colors.offline, fontWeight: '600' },
});
