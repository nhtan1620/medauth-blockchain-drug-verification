import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { verifyApi } from './api';
import type { QueuedScan } from './types';

const QUEUE_KEY = 'medauth.offlineQueue.v1';

export async function getQueue(): Promise<QueuedScan[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
}

async function saveQueue(queue: QueuedScan[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueScan(gtin: string, serial: string): Promise<QueuedScan> {
  const queue = await getQueue();
  const scan: QueuedScan = { gtin, serial, queuedAt: new Date().toISOString() };
  queue.push(scan);
  await saveQueue(queue);
  return scan;
}

export async function clearQueue(): Promise<void> {
  await saveQueue([]);
}

/**
 * Flush the local queue against the backend once connectivity returns.
 * Idempotent — the backend's /verify/offline-sync route can safely
 * replay the same scan twice, so a partial network failure mid-sync
 * never loses or double-books a pack read.
 */
export async function syncQueue(token: string): Promise<{ reconciled: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { reconciled: 0 };

  const { results } = await verifyApi.offlineSync(queue, token);
  await clearQueue();
  return { reconciled: results.length };
}

/** Subscribe to connectivity changes and auto-sync the queue on reconnect. */
export function watchConnectivityAndSync(token: string, onSynced?: (count: number) => void): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      try {
        const { reconciled } = await syncQueue(token);
        if (reconciled > 0) onSynced?.(reconciled);
      } catch {
        // Stay quiet — queue remains intact and will retry on the next
        // connectivity event or manual sync from the History screen.
      }
    }
  });
  return unsubscribe;
}
