export type UserRole = 'manufacturer' | 'wholesaler' | 'pharmacist' | 'regulator';

export interface AuthUser {
  id: string;
  identifier: string;
  role: UserRole;
  org: string;
}

export type VerifyStatus = 'AUTHENTIC' | 'COUNTERFEIT_SUSPECTED' | 'BARCODE_NOT_FOUND';

export interface VerifyResult {
  status: VerifyStatus;
  sgtin?: string;
  gtin?: string;
  lot?: string;
  serial?: string;
  expiry?: string;
  lastEvent?: string;
  lastOrg?: string;
  anchor?: string | null;
  reason?: string;
}

export interface EventTrailItem {
  blockIndex: number;
  org: string;
  bizStep: string;
  createdAt: string;
  blockHash: string;
}

export interface QueuedScan {
  gtin: string;
  serial: string;
  queuedAt: string;
  /** Populated once the scan is reconciled after reconnecting (R5). */
  result?: VerifyResult;
}
