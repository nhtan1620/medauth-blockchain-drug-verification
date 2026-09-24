import React, { useState } from 'react';
import { ScrollView, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ResultBadge } from '../components/ResultBadge';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { verifyApi } from '../services/api';
import type { EventTrailItem } from '../services/types';
import { colors, spacing, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export function ResultScreen({ navigation, route }: Props) {
  const { status, gtin, serial, result } = route.params;
  const { token } = useAuth();
  const [trail, setTrail] = useState<EventTrailItem[] | null>(null);
  const [loadingTrail, setLoadingTrail] = useState(false);

  const isQueued = status === 'QUEUED';

  async function loadEventTrail() {
    if (!token || !result?.sgtin) return;
    setLoadingTrail(true);
    try {
      const res = await verifyApi.eventTrail(result.sgtin, token);
      setTrail(res.trail);
    } catch {
      setTrail([]);
    } finally {
      setLoadingTrail(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {isQueued ? (
          <View style={[styles.queuedBanner]}>
            <Text style={styles.queuedText}>Saved offline — will verify automatically once you're back online.</Text>
          </View>
        ) : (
          <ResultBadge status={status as any} />
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pack facts</Text>
          <Row label="GTIN" value={gtin} />
          <Row label="Serial" value={serial} />
          {result?.lot ? <Row label="Lot" value={result.lot} /> : null}
          {result?.expiry ? <Row label="Expiry" value={new Date(result.expiry).toLocaleDateString()} /> : null}
          {result?.lastEvent ? <Row label="Last event" value={result.lastEvent} /> : null}
          {result?.lastOrg ? <Row label="Last org" value={result.lastOrg} /> : null}
          {result?.reason ? <Row label="Reason" value={result.reason} /> : null}
          {result?.anchor ? <Row label="Ledger anchor" value={result.anchor} mono /> : null}
        </View>

        {result?.sgtin && !trail ? (
          <PrimaryButton title="View full event trail" variant="secondary" onPress={loadEventTrail} loading={loadingTrail} />
        ) : null}

        {trail ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Event trail (GS1 EPCIS)</Text>
            {trail.length === 0 ? (
              <Text style={styles.body}>No events recorded.</Text>
            ) : (
              trail.map((e) => (
                <View key={e.blockIndex} style={styles.trailItem}>
                  <Text style={styles.trailStep}>{e.bizStep.toUpperCase()}</Text>
                  <Text style={styles.trailMeta}>{e.org} · {new Date(e.createdAt).toLocaleString()}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.actions}>
          {status === 'COUNTERFEIT_SUSPECTED' ? (
            <PrimaryButton title="Report to Regulator" onPress={() => navigation.navigate('HelpCenter')} />
          ) : null}
          <PrimaryButton title="Scan Another" onPress={() => navigation.replace('Scan', { offlineMode: false })} />
          <PrimaryButton title="Back to Home" variant="secondary" onPress={() => navigation.navigate('Home')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  queuedBanner: { backgroundColor: colors.offlineBg, borderRadius: 16, padding: spacing.lg },
  queuedText: { ...typography.body, color: colors.offline, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { ...typography.caption, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.textPrimary, maxWidth: '65%', textAlign: 'right' },
  mono: { fontFamily: 'Courier' },
  body: { ...typography.body, color: colors.textSecondary },
  trailItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  trailStep: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  trailMeta: { ...typography.caption, color: colors.textSecondary },
  actions: { gap: spacing.sm },
});
