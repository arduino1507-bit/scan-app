import { ScanItem } from '../types';
import { getSavedSpreadsheetId, saveSpreadsheetId } from './storage';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

export interface SheetInfo {
  id: string;
  url: string;
  name: string;
}

/**
 * Searches for an existing "Scan" spreadsheet in the user's Drive.
 * If not found or cached ID doesn't work, creates a new one named "Scan".
 */
export async function getOrCreateScanSpreadsheet(accessToken: string): Promise<SheetInfo> {
  const cachedId = getSavedSpreadsheetId();

  if (cachedId) {
    try {
      const resp = await fetch(`${SHEETS_BASE}/${cachedId}?fields=spreadsheetId,properties.title`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        return {
          id: data.spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
          name: data.properties?.title || 'Scan',
        };
      }
    } catch {
      console.warn('Could not verify cached spreadsheet ID, searching Drive...');
    }
  }

  // Search Drive for file name 'Scan' and mimeType spreadsheet
  try {
    const query = encodeURIComponent("name = 'Scan' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const driveResp = await fetch(`${DRIVE_BASE}/files?q=${query}&fields=files(id,name)&pageSize=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (driveResp.ok) {
      const driveData = await driveResp.json();
      if (driveData.files && driveData.files.length > 0) {
        const found = driveData.files[0];
        saveSpreadsheetId(found.id);
        return {
          id: found.id,
          url: `https://docs.google.com/spreadsheets/d/${found.id}/edit`,
          name: found.name,
        };
      }
    }
  } catch (err) {
    console.warn('Failed searching Drive for Scan spreadsheet:', err);
  }

  // Create new spreadsheet named "Scan"
  const createResp = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Scan',
      },
    }),
  });

  if (!createResp.ok) {
    const errorText = await createResp.text();
    throw new Error(`Failed to create "Scan" spreadsheet: ${createResp.status} ${errorText}`);
  }

  const createdData = await createResp.json();
  const newId = createdData.spreadsheetId;
  saveSpreadsheetId(newId);

  return {
    id: newId,
    url: `https://docs.google.com/spreadsheets/d/${newId}/edit`,
    name: 'Scan',
  };
}

/**
 * Ensures that a sheet/tab with title equal to `dateStr` exists in the spreadsheet.
 * If not present, creates it with header row in Ukrainian: ["Штрих-код / Номер", "Час сканування", "Формат"].
 */
export async function ensureDateSheetExists(
  accessToken: string,
  spreadsheetId: string,
  dateStr: string
): Promise<void> {
  // 1. Get existing sheet metadata
  const metaResp = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaResp.ok) {
    const errText = await metaResp.text();
    throw new Error(`Failed to inspect sheets in spreadsheet: ${errText}`);
  }

  const metaData = await metaResp.json();
  const sheets: Array<{ properties: { sheetId: number; title: string } }> = metaData.sheets || [];

  const existingSheet = sheets.find(s => s.properties.title === dateStr);
  if (existingSheet) {
    return; // Already exists
  }

  // 2. Add new sheet titled `dateStr`
  const addSheetResp = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: dateStr,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    }),
  });

  if (!addSheetResp.ok) {
    const err = await addSheetResp.text();
    // In case of race condition or sheet already created, ignore duplicate error
    if (!err.includes('already exists')) {
      throw new Error(`Failed to add date sheet "${dateStr}": ${err}`);
    }
  }

  // 3. Add header row in Ukrainian in column A1:C1
  const headerValues = [['Штрих-код / Номер', 'Час сканування', 'Формат']];
  await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/'${encodeURIComponent(dateStr)}'!A1:C1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: headerValues,
      }),
    }
  );
}

/**
 * Appends scanned barcode items to the sheet named `dateStr`.
 */
export async function appendScansToDateSheet(
  accessToken: string,
  spreadsheetId: string,
  dateStr: string,
  items: ScanItem[]
): Promise<void> {
  if (items.length === 0) return;

  // Make sure the date tab exists
  await ensureDateSheetExists(accessToken, spreadsheetId, dateStr);

  // Prepare row values. Formatted with apostrophe to keep string verbatim without stripping leading zeros
  const rows = items.map((item) => {
    const timeFormatted = new Date(item.timestamp).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return [
      `'${item.code}`,
      timeFormatted,
      item.format || 'BARCODE',
    ];
  });

  const range = `'${encodeURIComponent(dateStr)}'!A:C`;
  const appendResp = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!appendResp.ok) {
    const err = await appendResp.text();
    throw new Error(`Failed to append rows to sheet: ${err}`);
  }
}
