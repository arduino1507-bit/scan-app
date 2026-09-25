export interface ScanItem {
  id: string;
  code: string;
  format?: string;
  timestamp: number; // epoch ms
  dateStr: string;   // 'YYYY-MM-DD'
  synced: boolean;
  syncedAt?: number;
}

export interface DayGroup {
  dateStr: string;
  count: number;
  syncedCount: number;
  pendingCount: number;
  allSynced: boolean;
  items: ScanItem[];
}

export interface AppNotification {
  id: string;
  message: string;
  code?: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: number;
}
