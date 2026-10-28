import { createSign } from 'crypto';

/**
 * Minimal Google Sheets client (service account, no extra dependencies).
 * Requires GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and
 * GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. The spreadsheet must be shared with the
 * service account email as Editor.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export type SheetCell = string | number | boolean | null;

let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error('Google Sheets is not configured. Check the GOOGLE_* environment variables.');
  }
  return { spreadsheetId, clientEmail, privateKey };
}

/**
 * Rebuilds a valid PEM from the env value, whether it was pasted with real newlines,
 * escaped "\n" sequences, or with line breaks stripped entirely.
 */
function normalizePrivateKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const body = raw
    .replace(/\\n/g, '\n')
    .replace(/^["']|["']$/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!body) return null;
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }

  const { clientEmail, privateKey } = getConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: clientEmail, scope: SHEETS_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(privateKey));

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Google auth failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Google Sheets request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Appends rows to the given tab. Writes the header row first when the tab is empty.
 * Creates the tab if it does not exist yet.
 */
export async function appendRowsToSheet(tabName: string, headers: string[], rows: SheetCell[][]) {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`'${tabName}'!A1:A1`);

  // Ensure tab exists
  const meta = (await sheetsFetch(`${spreadsheetId}?fields=sheets.properties.title`)) as {
    sheets?: { properties: { title: string } }[];
  };
  const tabExists = meta.sheets?.some((s) => s.properties.title === tabName);
  if (!tabExists) {
    await sheetsFetch(`${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
    });
  }

  // Write header row if tab is empty
  const firstCell = (await sheetsFetch(`${spreadsheetId}/values/${range}`)) as { values?: unknown[][] };
  const values: SheetCell[][] = firstCell.values?.length ? [] : [headers];
  values.push(...rows);
  if (values.length === 0) return;

  // Append in chunks to stay well below request size limits
  const CHUNK = 2000;
  for (let i = 0; i < values.length; i += CHUNK) {
    await sheetsFetch(
      `${spreadsheetId}/values/${encodeURIComponent(`'${tabName}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: values.slice(i, i + CHUNK) }) }
    );
  }
}
