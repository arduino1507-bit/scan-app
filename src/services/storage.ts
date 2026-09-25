import { ScanItem } from './types';

const STORAGE_KEY = 'barcode_scanner_items_v1';
const SPREADSHEET_ID_KEY = 'barcode_scanner_sheet_id_v1';
const DEDUPE_SETTINGS_KEY = 'barcode_scanner_dedupe_mode_v1';
const MASK_SETTINGS_KEY = 'barcode_scanner_mask_prefix_v1';
const MASK_ENABLED_KEY = 'barcode_scanner_mask_enabled_v1';

export type DedupeMode = 'day' | 'all' | 'off';

/**
 * Mask / Prefix Filter settings
 */
export function getMaskSettings(): { prefix: string; enabled: boolean } {
  try {
    const prefix = localStorage.getItem(MASK_SETTINGS_KEY) || '';
    const enabledRaw = localStorage.getItem(MASK_ENABLED_KEY);
    const enabled = enabledRaw === 'true' && prefix.trim().length > 0;
    return { prefix: prefix.trim(), enabled };
  } catch {
    return { prefix: '', enabled: false };
  }
}

export function saveMaskSettings(prefix: string, enabled: boolean): void {
  try {
    localStorage.setItem(MASK_SETTINGS_KEY, prefix.trim());
    localStorage.setItem(MASK_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Failed to save mask settings:', e);
  }
}

/**
 * Checks if code satisfies current mask filter.
 * Returns true if passes, false if rejected.
 */
export function checkMaskMatches(code: string): { matches: boolean; requiredPrefix: string } {
  const { prefix, enabled } = getMaskSettings();
  if (!enabled || !prefix) {
    return { matches: true, requiredPrefix: '' };
  }

  const matches = code.trim().startsWith(prefix);
  return { matches, requiredPrefix: prefix };
}

export function getDedupeMode(): DedupeMode {
  try {
    const val = localStorage.getItem(DEDUPE_SETTINGS_KEY);
    if (val === 'day' || val === 'all' || val === 'off') {
      return val;
    }
    return 'day'; // Default: avoid duplicates for the current day
  } catch {
    return 'day';
  }
}

export function setDedupeMode(mode: DedupeMode): void {
  try {
    localStorage.setItem(DEDUPE_SETTINGS_KEY, mode);
  } catch (e) {
    console.error('Failed to save dedupe mode:', e);
  }
}

export function getLocalScans(): ScanItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load local scans:', e);
    return [];
  }
}

export function saveLocalScans(items: ScanItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save local scans:', e);
  }
}

export function checkIsDuplicate(
  code: string,
  dateStr: string,
  mode: DedupeMode = getDedupeMode()
): ScanItem | null {
  if (mode === 'off') return null;

  const normalized = code.trim();
  const all = getLocalScans();

  if (mode === 'day') {
    // Check if code was already scanned today
    return all.find((item) => item.dateStr === dateStr && item.code === normalized) || null;
  }

  if (mode === 'all') {
    // Check across all days
    return all.find((item) => item.code === normalized) || null;
  }

  return null;
}

export function addLocalScan(code: string, format = 'BARCODE'): ScanItem {
  const all = getLocalScans();
  const now = new Date();
  
  // Format date as YYYY-MM-DD in local time
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const newItem: ScanItem = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    code: code.trim(),
    format,
    timestamp: now.getTime(),
    dateStr,
    synced: false,
  };

  all.unshift(newItem);
  saveLocalScans(all);
  return newItem;
}

export function markScansAsSynced(ids: string[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const all = getLocalScans();
  const now = Date.now();
  
  let modified = false;
  for (const item of all) {
    if (idSet.has(item.id) && !item.synced) {
      item.synced = true;
      item.syncedAt = now;
      modified = true;
    }
  }

  if (modified) {
    saveLocalScans(all);
  }
}

export function deleteScanItem(id: string): void {
  const all = getLocalScans().filter(x => x.id !== id);
  saveLocalScans(all);
}

export function deleteDayScans(dateStr: string): void {
  const all = getLocalScans().filter(x => x.dateStr !== dateStr);
  saveLocalScans(all);
}

export function clearAllLocalScans(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSavedSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_ID_KEY);
}

export function saveSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
}
