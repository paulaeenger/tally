// Lightweight CSV parser. Handles quoted fields, escaped quotes, and
// auto-detects common bank CSV shapes (Chase, Amex, Wells Fargo, BoA,
// generic date/description/amount).

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
// Date parsing — accepts MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY (less common)
// ----------------------------------------------------------------
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim().replace(/"/g, '');

  // ISO like 2025-04-21 or 2025-04-21T12:00:00
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  // MM/DD/YYYY or M/D/YY (US format, most common bank CSV)
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const mm = Number(usMatch[1]);
    const dd = Number(usMatch[2]);
    let yyyy = Number(usMatch[3]);
    if (yyyy < 100) yyyy += 2000;
    const d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback — native Date parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// ----------------------------------------------------------------
// Amount parsing — handles "$1,234.56", "(123.45)" for negatives, "-123.45"
// ----------------------------------------------------------------
function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/["$\s]/g, '').replace(/,/g, '');
  let negative = false;

  // (123.45) format (accounting parens for negative)
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

// ----------------------------------------------------------------
// Find the right column for each concept using heuristics
// ----------------------------------------------------------------
function findColumn(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

// ----------------------------------------------------------------
// Main parser. Detects format from headers and returns normalized rows.
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

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const lower = headers.map((h) => h.toLowerCase());

  // Column discovery
  const dateCol = findColumn(headers, [/date/i, /posted/i, /^when/i]);
  const descCol = findColumn(headers, [/description/i, /merchant/i, /payee/i, /name/i]);
  const amountCol = findColumn(headers, [/^amount$/i, /\bamount\b/i]);
  const debitCol = findColumn(headers, [/debit/i, /withdrawal/i]);
  const creditCol = findColumn(headers, [/credit/i, /deposit/i]);

  // Detect format name
  let detectedFormat = 'Generic CSV';
  if (lower.some((h) => h.includes('transaction date')) && lower.some((h) => h.includes('post date'))) {
    detectedFormat = 'Chase';
  } else if (lower.some((h) => h === 'date') && debitCol !== -1 && creditCol !== -1) {
    detectedFormat = 'Wells Fargo / Bank of America';
  } else if (lower.some((h) => h.includes('trans. date')) || lower.some((h) => h.includes('amex'))) {
    detectedFormat = 'American Express';
  } else if (amountCol !== -1 && descCol !== -1 && dateCol !== -1) {
    detectedFormat = 'Generic (date / description / amount)';
  }

  const rows: ParsedRow[] = [];
  const skipped: { row: string; reason: string }[] = [];

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const cells = parseCSVLine(rawLine);

    // Date
    const dateRaw = dateCol >= 0 ? cells[dateCol] : '';
    const date = parseDate(dateRaw);
    if (!date) {
      skipped.push({ row: rawLine, reason: 'Could not parse date' });
      continue;
    }

    // Merchant / description
    const desc = descCol >= 0 ? cells[descCol] : '';
    if (!desc) {
      skipped.push({ row: rawLine, reason: 'Missing description' });
      continue;
    }

    // Amount — prefer unified "Amount" column, else split debit/credit
    let amount: number | null = null;
    if (amountCol >= 0) {
      amount = parseAmount(cells[amountCol]);
    } else if (debitCol >= 0 || creditCol >= 0) {
      const debit = debitCol >= 0 ? parseAmount(cells[debitCol]) : null;
      const credit = creditCol >= 0 ? parseAmount(cells[creditCol]) : null;
      if (debit && debit !== 0) amount = -Math.abs(debit); // debit = expense
      else if (credit && credit !== 0) amount = Math.abs(credit); // credit = income
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
// Clean up merchant strings — strip trailing refs, store numbers, etc.
// "IHOP #2247 SALT LAKE C UT" → "IHOP"
// "AMAZON.COM*HM39K8AB2 AMZN.COM/BILL WA" → "Amazon"
// ----------------------------------------------------------------
function cleanMerchant(raw: string): string {
  let s = raw.trim();
  // Strip common noise patterns
  s = s.replace(/\s+#\d+.*/i, ''); // "#2247 SALT LAKE..."
  s = s.replace(/\s+\*[A-Z0-9]{6,}.*/i, ''); // "*HM39K8AB2..."
  s = s.replace(/\s+[A-Z]{2}\s*$/i, ''); // trailing state code "UT"
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/\s+\d{5}$/, ''); // trailing zip
  // Title-case obvious shouting
  if (s === s.toUpperCase() && s.length > 3) {
    s = s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      // Keep known all-caps acronyms
      .replace(/\bIhop\b/g, 'IHOP')
      .replace(/\bUsps\b/g, 'USPS')
      .replace(/\bAtm\b/g, 'ATM');
  }
  return s;
}
