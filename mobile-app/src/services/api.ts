import type { AuthUser, EventTrailItem, QueuedScan, VerifyResult } from './types';

// Point this at your running backend (see /backend). Defaults to the
// local dev server; override per environment (e.g. via app.config.ts + extra).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.reason || `Request failed (${res.status})`);
  }
  return body as T;
}

export const authApi = {
  requestOtp: (identifier: string) =>
    request<{ message: string; expiresAt: string; devCode?: string }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

  verifyOtp: (identifier: string, code: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ identifier, code }),
    }),
};

export const verifyApi = {
  scan: (gtin: string, serial: string, token: string) =>
    request<VerifyResult>('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ gtin, serial }),
    }, token),

  offlineSync: (scans: QueuedScan[], token: string) =>
    request<{ reconciled: number; results: (VerifyResult & { queuedAt: string })[] }>(
      '/api/verify/offline-sync',
      { method: 'POST', body: JSON.stringify({ scans }) },
      token
    ),

  eventTrail: (sgtin: string, token: string) =>
    request<{ sgtin: string; trail: EventTrailItem[] }>(`/api/events/${encodeURIComponent(sgtin)}`, {}, token),
};

export const regulatorApi = {
  auditPacks: (token: string) => request<{ count: number; packs: any[] }>('/api/audit/packs', {}, token),
  anomalies: (token: string) => request<{ anomalies: any[] }>('/api/audit/anomalies', {}, token),
};
