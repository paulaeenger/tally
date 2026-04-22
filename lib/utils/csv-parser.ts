// Lightweight CSV parser. Handles quoted fields, escaped quotes, and
// auto-detects common bank CSV shapes including those with metadata rows
// above the header.

export interface ParsedRow {
  occurred_at: string; // ISO
  merchant: string;
  amount: number; // positive
  type: 'income' | 'expense';
  raw: string; // original row text for user reference
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: { row: string; reason: string }[];
  detectedFormat: string;
  rawHeaders: string[];
}

// ----------------------------------------------------------------
// CSV tokenizer — handles quoted fields, escaped quotes, and CRLF
// ----------------------------------------------------------------
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.length > 0);
}

// ----------------------------------------------------------------
// Date parsing
// ----------------------------------------------------------------
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim().replace(/"/g, '');

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const mm = Number(usMatch[1]);
    const dd = Number(usMatch[2]);
    let yyyy = Number(usMatch[3]);
    if (yyyy < 100) yyyy += 2000;
    const d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// ----------------------------------------------------------------
// Amount parsing
// ----------------------------------------------------------------
function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/["$\s]/g, '').replace(/,/g, '');
  if (!s) return null;
  let negative = false;

  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith('+')) {
    s = s.slice(1);
  }

  const n = Number(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

// ----------------------------------------------------------------
// Header detection — scans the first ~10 rows looking for the first one
// that "looks like" a real header row. A real header row contains at
// least one recognizable finance column (date + amount-ish, or debit/credit).
// ----------------------------------------------------------------
function findHeaderRow(lines: string[]): { headerIdx: number; headers: string[] } | null {
  const maxScan = Math.min(lines.length, 15);
  for (let i = 0; i < maxScan; i++) {
    const cells = parseCSVLine(lines[i]);
    const lower = cells.map((c) => c.toLowerCase());

    const hasDate = lower.some((h) => /\bdate\b|posted|^when/i.test(h));
    const hasAmount = lower.some((h) => /\bamount\b|debit|credit|withdrawal|deposit/i.test(h));
    const hasDescription = lower.some((h) =>
      /description|merchant|payee|name|memo/i.test(h)
    );

    // Strict check: at least a date column + (amount OR debit/credit) + description
    if (hasDate && hasAmount && hasDescription) {
      return { headerIdx: i, headers: cells };
    }
  }
  return null;
}

// ----------------------------------------------------------------
// Main parser
// ----------------------------------------------------------------
export function parseCSV(text: string): ParseResult {
  const lines = splitLines(text);
  if (lines.length < 2) {
    return {
      rows: [],
      skipped: [],
      detectedFormat: 'Empty or invalid CSV',
      rawHeaders: [],
    };
  }

  const headerResult = findHeaderRow(lines);
  if (!headerResult) {
    return {
      rows: [],
      skipped: lines.map((l) => ({ row: l, reason: 'No recognizable header row' })),
      detectedFormat: 'Could not detect CSV format',
      rawHeaders: parseCSVLine(lines[0]),
    };
  }

  const { headerIdx, headers } = headerResult;
  const lower = headers.map((h) => h.toLowerCase());

  const dateCol = findColumn(headers, [/^date$/i, /^posted date$/i, /^transaction date$/i, /date/i]);
  const descCol = findColumn(headers, [/description/i, /merchant/i, /payee/i, /^name$/i]);
  const memoCol = findColumn(headers, [/memo/i]);
  const amountCol = headers.findIndex((h) => h.toLowerCase() === 'amount');
  const debitCol = findColumn(headers, [/^debit$/i, /withdrawal/i]);
  const creditCol = findColumn(headers, [/^credit$/i, /deposit/i]);

  // Format detection — for display only, doesn't affect parsing
  let detectedFormat = 'Generic CSV';
  if (lower.some((h) => h.includes('transaction date')) && lower.some((h) => h.includes('post date'))) {
    detectedFormat = 'Chase';
  } else if (debitCol !== -1 && creditCol !== -1 && memoCol !== -1) {
    detectedFormat = 'Credit Union / Bank (Debit + Credit + Memo)';
  } else if (debitCol !== -1 && creditCol !== -1) {
    detectedFormat = 'Wells Fargo / Bank of America';
  } else if (lower.some((h) => h.includes('trans. date')) || lower.some((h) => h.includes('amex'))) {
    detectedFormat = 'American Express';
  } else if (amountCol !== -1 && descCol !== -1 && dateCol !== -1) {
    detectedFormat = 'Generic (date / description / amount)';
  }

  const rows: ParsedRow[] = [];
  const skipped: { row: string; reason: string }[] = [];

  for (let lineIdx = headerIdx + 1; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const cells = parseCSVLine(rawLine);

    // Skip empty/near-empty rows
    if (cells.every((c) => c.trim().length === 0)) continue;

    const dateRaw = dateCol >= 0 ? cells[dateCol] : '';
    const date = parseDate(dateRaw);
    if (!date) {
      skipped.push({ row: rawLine, reason: 'Could not parse date' });
      continue;
    }

    const desc = descCol >= 0 ? cells[descCol] : '';
    if (!desc) {
      skipped.push({ row: rawLine, reason: 'Missing description' });
      continue;
    }

    // Amount resolution
    let amount: number | null = null;
    if (amountCol >= 0) {
      amount = parseAmount(cells[amountCol]);
    } else if (debitCol >= 0 || creditCol >= 0) {
      const debitStr = debitCol >= 0 ? cells[debitCol] : '';
      const creditStr = creditCol >= 0 ? cells[creditCol] : '';
      const debit = parseAmount(debitStr);
      const credit = parseAmount(creditStr);
      if (debit !== null && debit !== 0) amount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amount = Math.abs(credit);
    }

    if (amount === null || amount === 0) {
      skipped.push({ row: rawLine, reason: 'Missing or zero amount' });
      continue;
    }

    rows.push({
      occurred_at: date.toISOString(),
      merchant: cleanMerchant(desc),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      raw: rawLine,
    });
  }

  return { rows, skipped, detectedFormat, rawHeaders: headers };
}

// ----------------------------------------------------------------
// Merchant cleaner — aggressively strips bank noise.
// Examples handled:
//   "PARAMOUNT ACCEPT VASAFIT REF # 026099003202241 PARAMOUNT ACCEPT87-0366091VASAFIT PPD64181143347WTT Paul Enger REF # 26099003202241 3202241 (PARAMOUNT ACCEPT VASAFIT WTT Paul Enger)"
//   → "Paramount Accept Vasafit"
//   "IHOP #2247 SALT LAKE C UT" → "IHOP"
//   "AMAZON.COM*HM39K8AB2 AMZN.COM/BILL WA" → "Amazon.com"
// ----------------------------------------------------------------
function cleanMerchant(raw: string): string {
  let s = raw.trim();

  // 1. Take everything before the first "REF #" — that marker almost
  //    always signals the start of bank metadata
  s = s.split(/\s+REF\s*#/i)[0];

  // 2. Remove trailing parenthetical transcriptions: "... (XYZ)"
  s = s.replace(/\s*\([^)]*\)\s*$/, '');

  // 3. Strip common noise patterns
  s = s.replace(/\s+#\d+.*/, ''); // "#2247 SALT LAKE..."
  s = s.replace(/\s+\*[A-Z0-9]{6,}.*/i, ''); // "*HM39K8AB2..."
  s = s.replace(/\s+\d{5,}.*/, ''); // long digit sequences like routing/ID numbers
  s = s.replace(/\s+PPD\d+.*/i, ''); // "PPD64181143347..."
  s = s.replace(/\s+WEB\d+.*/i, ''); // "WEB17261435383..."
  s = s.replace(/\s+\d{2}-\d{7}.*/, ''); // EIN-style codes "87-0366091..."
  s = s.replace(/\s+[A-Z]{2,3}\d+.*/, ''); // "PPD123..", "ACH123.."

  // 4. Collapse whitespace
  s = s.replace(/\s{2,}/g, ' ').trim();

  // 5. Trailing state code ("UT") or zip ("84101") if still present
  s = s.replace(/\s+[A-Z]{2}\s*$/, '');
  s = s.replace(/\s+\d{5}(-\d{4})?$/, '');

  // 6. Limit length — anything over ~40 chars is still noise
  if (s.length > 40) {
    s = s.slice(0, 40).trim();
  }

  // 7. Title-case ALL CAPS strings, but preserve common acronyms
  if (s === s.toUpperCase() && s.length > 3) {
    s = s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bIhop\b/g, 'IHOP')
      .replace(/\bUsps\b/g, 'USPS')
      .replace(/\bUps\b/g, 'UPS')
      .replace(/\bAtm\b/g, 'ATM')
      .replace(/\bAch\b/g, 'ACH')
      .replace(/\bAmzn\b/g, 'Amazon')
      .replace(/\bUsaa\b/g, 'USAA');
  }

  return s || raw.slice(0, 40);
}
