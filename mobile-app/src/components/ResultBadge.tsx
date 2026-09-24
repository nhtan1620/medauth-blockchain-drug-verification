import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';
import type { VerifyStatus } from '../services/types';

const STATUS_CONFIG: Record<VerifyStatus, { label: string; icon: string; fg: string; bg: string }> = {
  AUTHENTIC: { label: 'Authentic', icon: '✓', fg: colors.authentic, bg: colors.authenticBg },
  COUNTERFEIT_SUSPECTED: { label: 'Counterfeit suspected', icon: '⚠', fg: colors.counterfeit, bg: colors.counterfeitBg },
  BARCODE_NOT_FOUND: { label: 'Barcode not found', icon: '?', fg: colors.notFound, bg: colors.notFoundBg },
};

export function ResultBadge({ status }: { status: VerifyStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View
      style={[styles.container, { backgroundColor: cfg.bg }]}
      accessibilityRole="alert"
      accessibilityLabel={cfg.label}
    >
      <Text style={[styles.icon, { color: cfg.fg }]}>{cfg.icon}</Text>
      <Text style={[styles.label, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  icon: { fontSize: 32, marginRight: spacing.sm },
  label: { ...typography.h2 },
});
