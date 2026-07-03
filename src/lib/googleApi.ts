export interface SheetRow {
  timestamp: string;
  transcript: string;
  summary: string;
}

// Key for caching Spreadsheet ID in localStorage
const SHEET_ID_KEY = "voice_to_sheet_spreadsheet_id";

/**
 * Searches for a Google Sheet named "Voice to Sheet AI" in the user's Google Drive.
 * If found, returns its spreadsheetId. Otherwise returns null.
 */
export async function findSpreadsheet(token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D%27Voice+to+Sheet+AI%27+and+mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27+and+trashed%3Dfalse&fields=files(id%2Cname)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search Google Drive: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      const id = data.files[0].id;
      localStorage.setItem(SHEET_ID_KEY, id);
      return id;
    }
    return null;
  } catch (error) {
    console.error("Error in findSpreadsheet:", error);
    return null;
  }
}

/**
 * Creates a new Spreadsheet named "Voice to Sheet AI" and initializes it with headers.
 */
export async function createSpreadsheet(token: string): Promise<string> {
  try {
    // 1. Create Spreadsheet
    const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: "Voice to Sheet AI",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create spreadsheet: ${response.statusText}`);
    }

    const sheetInfo = await response.json();
    const spreadsheetId = sheetInfo.spreadsheetId;

    if (!spreadsheetId) {
      throw new Error("Created spreadsheet did not return an ID.");
    }

    // 2. Initialize Headers
    const initResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:C1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: "Sheet1!A1:C1",
          majorDimension: "ROWS",
          values: [["Timestamp", "Transcript", "AI Summary"]],
        }),
      }
    );

    if (!initResponse.ok) {
      throw new Error("Failed to initialize headers in the new spreadsheet.");
    }

    localStorage.setItem(SHEET_ID_KEY, spreadsheetId);
    return spreadsheetId;
  } catch (error) {
    console.error("Error in createSpreadsheet:", error);
    throw error;
  }
}

/**
 * Gets the spreadsheet ID, either from localStorage cache, searching Drive, or creating a new one.
 */
export async function getOrCreateSpreadsheetId(token: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cachedId = localStorage.getItem(SHEET_ID_KEY);
    if (cachedId) return cachedId;
  }

  const existingId = await findSpreadsheet(token);
  if (existingId) return existingId;

  return await createSpreadsheet(token);
}

/**
 * Appends a new transcript and summary row to the Google Sheet.
 */
export async function appendRow(
  token: string,
  spreadsheetId: string,
  transcript: string,
  summary: string
): Promise<void> {
  const timestamp = new Date().toLocaleString();

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:C:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [[timestamp, transcript, summary]],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to append row to Google Sheet: ${response.statusText}`
    );
  }
}

/**
 * Fetches recent records from the Google Sheet.
 */
export async function fetchSheetRows(token: string, spreadsheetId: string): Promise<SheetRow[]> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:C`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet values: ${response.statusText}`);
    }

    const data = await response.json();
    const values: string[][] = data.values || [];

    if (values.length <= 1) {
      return []; // Just headers or empty sheet
    }

    // Skip headers (row 0), and map values to SheetRow objects
    const dataRows = values.slice(1);
    return dataRows.map((row) => ({
      timestamp: row[0] || "",
      transcript: row[1] || "",
      summary: row[2] || "",
    }));
  } catch (error) {
    console.error("Error in fetchSheetRows:", error);
    throw error;
  }
}
