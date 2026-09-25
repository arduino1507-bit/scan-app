import { getLocalScans, markScansAsSynced } from './storage';
import { getAccessToken } from './auth';
import { getOrCreateScanSpreadsheet, appendScansToDateSheet } from './sheets';
import { ScanItem } from '../types';

let isSyncing = false;
type SyncCallback = (status: {
  isSyncing: boolean;
  successCount?: number;
  error?: string | null;
  spreadsheetUrl?: string | null;
}) => void;

const listeners = new Set<SyncCallback>();

export function subscribeSync(cb: SyncCallback) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function broadcast(status: {
  isSyncing: boolean;
  successCount?: number;
  error?: string | null;
  spreadsheetUrl?: string | null;
}) {
  listeners.forEach((fn) => fn(status));
}

/**
 * Triggers synchronization of all unsynced local scans to Google Sheets.
 * If offline or not authenticated, safely exits.
 */
export async function syncPendingScans(): Promise<{
  synced: number;
  spreadsheetUrl?: string;
  error?: string;
}> {
  if (isSyncing) {
    return { synced: 0 };
  }

  // Check online status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    broadcast({ isSyncing: false, error: 'Пристрій офлайн' });
    return { synced: 0, error: 'Офлайн' };
  }

  const token = getAccessToken();
  if (!token) {
    // Cannot sync without Google OAuth token
    return { synced: 0, error: 'Потрібна авторизація в Google' };
  }

  const allScans = getLocalScans();
  const unsynced = allScans.filter((s) => !s.synced);

  if (unsynced.length === 0) {
    broadcast({ isSyncing: false, successCount: 0 });
    return { synced: 0 };
  }

  isSyncing = true;
  broadcast({ isSyncing: true });

  try {
    // 1. Get or create the "Scan" spreadsheet
    const sheetInfo = await getOrCreateScanSpreadsheet(token);

    // 2. Group unsynced items by dateStr
    const groupsByDate = new Map<string, ScanItem[]>();
    for (const item of unsynced) {
      const arr = groupsByDate.get(item.dateStr) || [];
      arr.push(item);
      groupsByDate.set(item.dateStr, arr);
    }

    // 3. Append to each date sheet
    let totalSynced = 0;
    const syncedIds: string[] = [];

    for (const [dateStr, items] of groupsByDate.entries()) {
      await appendScansToDateSheet(token, sheetInfo.id, dateStr, items);
      items.forEach((item) => syncedIds.push(item.id));
      totalSynced += items.length;
    }

    // 4. Mark items as synced locally
    markScansAsSynced(syncedIds);

    broadcast({
      isSyncing: false,
      successCount: totalSynced,
      spreadsheetUrl: sheetInfo.url,
      error: null,
    });

    return {
      synced: totalSynced,
      spreadsheetUrl: sheetInfo.url,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error during auto-sync:', err);
    broadcast({
      isSyncing: false,
      error: errorMsg,
    });
    return {
      synced: 0,
      error: errorMsg,
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Sets up auto-sync listeners when internet returns or window focuses.
 */
export function initAutoSyncListener() {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('Network online detected, triggering auto-sync...');
    syncPendingScans();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncPendingScans();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
