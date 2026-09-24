import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PrimaryButton } from '../components/PrimaryButton';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { useAuth } from '../context/AuthContext';
import { verifyApi } from '../services/api';
import { enqueueScan } from '../services/offlineQueue';
import { colors, spacing, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

/** Parses a GS1 Data Matrix / GS1-128 payload of the form (01)GTIN(21)SERIAL, or falls back to manual input. */
function parseGs1Payload(raw: string): { gtin: string; serial: string } | null {
  const gtinMatch = raw.match(/01(\d{14})/);
  const serialMatch = raw.match(/21([^\x1d]+)/); // \x1d = GS1 FNC1 separator
  if (gtinMatch && serialMatch) return { gtin: gtinMatch[1], serial: serialMatch[1] };
  return null;
}

export function ScanScreen({ navigation, route }: Props) {
  const offlineMode = route.params?.offlineMode ?? false;
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualGtin, setManualGtin] = useState('');
  const [manualSerial, setManualSerial] = useState('');
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleResolvedScan(gtin: string, serial: string) {
    if (busy) return;
    setBusy(true);
    setScanning(false);
    try {
      if (offlineMode || !token) {
        await enqueueScan(gtin, serial);
        navigation.replace('Result', { status: 'QUEUED', gtin, serial });
        return;
      }
      const result = await verifyApi.scan(gtin, serial, token);
      navigation.replace('Result', { status: result.status, gtin, serial, result });
    } catch (err) {
      // Network failure mid-scan — fall back to the offline queue rather than losing the read.
      await enqueueScan(gtin, serial);
      navigation.replace('Result', { status: 'QUEUED', gtin, serial });
    } finally {
      setBusy(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    const parsed = parseGs1Payload(data);
    if (parsed) {
      handleResolvedScan(parsed.gtin, parsed.serial);
    } else if (/^\d{13,14}$/.test(data)) {
      // Plain GTIN-only barcode — ask for serial manually.
      setManualGtin(data);
      setScanning(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <OfflineIndicator />
      <Text style={styles.title}>Scan Pack</Text>

      <View style={styles.viewfinder}>
        {permission?.granted ? (
          scanning ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['datamatrix', 'code128', 'ean13'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          ) : (
            <View style={styles.centered}>
              <Text style={styles.hint}>{busy ? 'Verifying…' : 'Paused'}</Text>
            </View>
          )
        ) : (
          <View style={styles.centered}>
            <Text style={styles.hint}>Camera access is needed to scan a pack.</Text>
            <PrimaryButton title="Enable Camera" onPress={requestPermission} />
          </View>
        )}
      </View>

      <View style={styles.manualEntry}>
        <Text style={styles.manualLabel}>Or enter manually</Text>
        <TextInput
          style={styles.input}
          placeholder="GTIN (13–14 digits)"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          value={manualGtin}
          onChangeText={setManualGtin}
        />
        <TextInput
          style={styles.input}
          placeholder="Serial number"
          placeholderTextColor={colors.textSecondary}
          value={manualSerial}
          onChangeText={setManualSerial}
        />
        <PrimaryButton
          title="Verify"
          onPress={() => handleResolvedScan(manualGtin.trim(), manualSerial.trim())}
          disabled={manualGtin.trim().length < 13 || manualSerial.trim().length === 0}
          loading={busy}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary },
  viewfinder: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    minHeight: 260,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  hint: { ...typography.body, color: '#fff', textAlign: 'center' },
  manualEntry: { gap: spacing.sm },
  manualLabel: { ...typography.caption, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 16,
  },
});
