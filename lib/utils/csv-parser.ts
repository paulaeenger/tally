// Target path in your repo: lib/utils/csv-parser.ts (REPLACE existing file)
//
// Lightweight CSV parser. Handles quoted fields, escaped quotes, and
// auto-detects common bank CSV shapes.
//
// This version also extracts an optional `external_id` (bank-provided
// transaction ID) when present, and computes a client-side `fingerprint`
// that mirrors the Postgres trigger in the transactions table. Both are
// used to pre-flag likely duplicates in the import preview.

export interface ParsedRow {
  occurred_at: string;
  merchant: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  external_id: string | null;
  fingerprint: string; // filled in by caller once account is chosen
  raw: string;
  // If a merchant rule matched this row, the id of that rule.
  // Used by the caller to bump match_count after a successful import.
  matchedRuleId?: string | null;
  // The category suggested by the matched rule (if any).
  suggestedCategoryId?: string | null;
  // True when the row was auto-classified as a transfer based on merchant
  // keywords (e.g., "Capital One Mobile Pmt"). The UI can show a hint
  // letting the user know this was a guess.
  autoDetectedTransfer?: boolean;
}

/**
 * A minimal subset of a merchant rule that the parser needs.
 * Keeps the parser decoupled from the DB shape.
 */
export interface MerchantRuleLike {
  id: string;
  pattern: string;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: { row: string; reason: string }[];
  detectedFormat: string;
  rawHeaders: string[];
}

// ----------------------------------------------------------------
// CSV tokenizer
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
// Header detection
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

    if (hasDate && hasAmount && hasDescription) {
      return { headerIdx: i, headers: cells };
    }
  }
  return null;
}

// ----------------------------------------------------------------
// MD5 — must produce identical output to Postgres's md5() because
// our fingerprint is computed both client-side (here) and server-side
// (the trigger in transactions table). Verified against RFC 1321
// test vectors AND against Postgres output for identical inputs.
// ----------------------------------------------------------------
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const msgLen = bytes.length;
  const numBlocks = (((msgLen + 8) >> 6) + 1);
  const totalWords = numBlocks * 16;
  const words = new Array<number>(totalWords).fill(0);

  for (let i = 0; i < msgLen; i++) {
    words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }
  words[msgLen >> 2] |= 0x80 << ((msgLen % 4) * 8);
  words[totalWords - 2] = msgLen * 8;

  const addu = (a: number, b: number) => ((a + b) & 0xffffffff) | 0;
  const rol = (n: number, s: number) => ((n << s) | (n >>> (32 - s))) | 0;

  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    addu(rol(addu(addu(addu(a, (b & c) | (~b & d)), x), t), s), b);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    addu(rol(addu(addu(addu(a, (b & d) | (c & ~d)), x), t), s), b);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    addu(rol(addu(addu(addu(a, b ^ c ^ d), x), t), s), b);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    addu(rol(addu(addu(addu(a, c ^ (b | ~d)), x), t), s), b);

  let a = 0x67452301 | 0;
  let b = 0xefcdab89 | 0;
  let c = 0x98badcfe | 0;
  let d = 0x10325476 | 0;

  for (let i = 0; i < totalWords; i += 16) {
    const aa = a, bb = b, cc = c, dd = d;

    a = ff(a, b, c, d, words[i + 0], 7, -680876936);
    d = ff(d, a, b, c, words[i + 1], 12, -389564586);
    c = ff(c, d, a, b, words[i + 2], 17, 606105819);
    b = ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4], 7, -176418897);
    d = ff(d, a, b, c, words[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, words[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = ff(a, b, c, d, words[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, words[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, words[i + 10], 17, -42063);
    b = ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, words[i + 13], 12, -40341101);
    c = ff(c, d, a, b, words[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, words[i + 15], 22, 1236535329);

    a = gg(a, b, c, d, words[i + 1], 5, -165796510);
    d = gg(d, a, b, c, words[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, words[i + 11], 14, 643717713);
    b = gg(b, c, d, a, words[i + 0], 20, -373897302);
    a = gg(a, b, c, d, words[i + 5], 5, -701558691);
    d = gg(d, a, b, c, words[i + 10], 9, 38016083);
    c = gg(c, d, a, b, words[i + 15], 14, -660478335);
    b = gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = gg(a, b, c, d, words[i + 9], 5, 568446438);
    d = gg(d, a, b, c, words[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, words[i + 3], 14, -187363961);
    b = gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, words[i + 2], 9, -51403784);
    c = gg(c, d, a, b, words[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, words[i + 12], 20, -1926607734);

    a = hh(a, b, c, d, words[i + 5], 4, -378558);
    d = hh(d, a, b, c, words[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, words[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = hh(a, b, c, d, words[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, words[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, words[i + 7], 16, -155497632);
    b = hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13], 4, 681279174);
    d = hh(d, a, b, c, words[i + 0], 11, -358537222);
    c = hh(c, d, a, b, words[i + 3], 16, -722521979);
    b = hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = hh(a, b, c, d, words[i + 9], 4, -640364487);
    d = hh(d, a, b, c, words[i + 12], 11, -421815835);
    c = hh(c, d, a, b, words[i + 15], 16, 530742520);
    b = hh(b, c, d, a, words[i + 2], 23, -995338651);

    a = ii(a, b, c, d, words[i + 0], 6, -198630844);
    d = ii(d, a, b, c, words[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, words[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = ii(a, b, c, d, words[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, words[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, words[i + 10], 15, -1051523);
    b = ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, words[i + 15], 10, -30611744);
    c = ii(c, d, a, b, words[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4], 6, -145523070);
    d = ii(d, a, b, c, words[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, words[i + 2], 15, 718787259);
    b = ii(b, c, d, a, words[i + 9], 21, -343485551);

    a = addu(a, aa);
    b = addu(b, bb);
    c = addu(c, cc);
    d = addu(d, dd);
  }

  const toHex = (n: number) => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const byte = (n >> (i * 8)) & 0xff;
      s += byte.toString(16).padStart(2, '0');
    }
    return s;
  };

  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

// ----------------------------------------------------------------
// Fingerprint — MUST match the Postgres trigger exactly.
// See supabase/migrations/20260422_transaction_dedup.sql for the
// canonical definition. Uses epoch milliseconds (a simple integer)
// so both sides compute the same value without timezone or formatting
// ambiguity. Verified by local test: JS and Postgres produced
// identical hashes for the same input.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// Merchant normalization — strips bank export prefixes that vary
// across CSV formats but describe the same merchant. Must match
// the Postgres normalize_merchant() function exactly.
// ----------------------------------------------------------------
export function normalizeMerchant(input: string): string {
  if (!input) return '';
  let result = input.toLowerCase().trim();

  // Strip common bank export prefixes (longest first)
  result = result.replace(/^(electronic deposit|electronic withdrawal|electronic payment)\s+/i, '');
  result = result.replace(/^(web|ppd|ach|eft|pos|atm|chk)\s+/i, '');

  // Collapse multiple spaces
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

// ----------------------------------------------------------------
// Compute fingerprint — content-based (no account_id).
// Same merchant + amount + date + type = duplicate, regardless of
// which account it's imported into.
// Must match the Postgres trigger output exactly.
// ----------------------------------------------------------------
export function computeFingerprint(params: {
  occurredAt: string;
  amount: number;
  merchant: string;
  type: 'income' | 'expense' | 'transfer';
}): string {
  const epochMs = new Date(params.occurredAt).getTime();
  const amountPart = params.amount.toFixed(2);
  const merchantPart = normalizeMerchant(params.merchant);

  const canonical = `${epochMs}|${amountPart}|${merchantPart}|${params.type}`;
  return md5(canonical);
}

// ----------------------------------------------------------------
// Probable-duplicate detection
//
// Catches near-duplicates that the strict fingerprint check misses:
//   - Same payment posted on different days (pending vs settled)
//   - Same merchant with text variants ("Pmt" vs "Pymt")
//   - Same merchant with different bank-statement framing
//
// Uses a combination of:
//   - Same amount (exact)
//   - Same type
//   - Date within ±3 days
//   - Similar merchant: substring containment OR Levenshtein distance ≤ 2
// ----------------------------------------------------------------

export interface DupCandidate {
  occurred_at: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  type: 'income' | 'expense' | 'transfer';
}

/**
 * Compute Levenshtein distance between two strings.
 * Used to catch typo-level merchant variants like "Pmt" vs "Pymt".
 * Capped at maxDistance for efficiency — returns Infinity if exceeded.
 */
function levenshtein(a: string, b: string, maxDistance: number = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return Infinity;

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let minInRow = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < minInRow) minInRow = curr[j];
    }
    if (minInRow > maxDistance) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Test whether two merchant strings are "probably the same merchant".
 * Conservative — meant to catch obvious variants, not aggressively merge.
 */
function merchantsAreSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aNorm = normalizeMerchant(a);
  const bNorm = normalizeMerchant(b);
  if (!aNorm || !bNorm) return false;
  if (aNorm === bNorm) return true;

  // Substring match: one merchant fully contains the other (case-insensitive).
  // Require the shorter one to be at least 6 chars to avoid spurious matches.
  const shorter = aNorm.length < bNorm.length ? aNorm : bNorm;
  const longer = aNorm.length < bNorm.length ? bNorm : aNorm;
  if (shorter.length >= 6 && longer.includes(shorter)) return true;

  // Word-overlap: if one merchant's distinctive words (4+ chars each)
  // ALL appear in the other's text. This catches "RTP Paul Enger" vs
  // "REAL TIME PAYMENT TO Paul Enger" — the words "paul" and "enger"
  // appear in both, and they're the distinctive part.
  // Require at least 2 distinctive words to overlap, to avoid matching
  // by a single common word.
  const wordsA = aNorm.split(/\s+/).filter((w) => w.length >= 4);
  const wordsB = bNorm.split(/\s+/).filter((w) => w.length >= 4);
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    let overlap = 0;
    for (const w of setA) if (setB.has(w)) overlap++;
    if (overlap >= 2) return true;
  }

  // Levenshtein for typo-level variants. Allow up to 2 character edits
  // for short strings, 3 for longer.
  const maxEdits = Math.max(aNorm.length, bNorm.length) >= 12 ? 3 : 2;
  if (levenshtein(aNorm, bNorm, maxEdits) <= maxEdits) return true;

  return false;
}

/**
 * Find a probable-duplicate match for a candidate row.
 * Returns the matching existing transaction, or null if no probable match.
 *
 * Match criteria (all must hold):
 *   - Same amount (exact match)
 *   - Same type
 *   - Date within ±3 days
 *   - Merchant is similar (per merchantsAreSimilar)
 */
export function findProbableMatch(
  candidate: {
    occurredAt: string;
    amount: number;
    merchant: string;
    type: 'income' | 'expense' | 'transfer';
  },
  existing: DupCandidate[]
): DupCandidate | null {
  const candDate = new Date(candidate.occurredAt).getTime();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const candAmount = Math.abs(candidate.amount);

  for (const ex of existing) {
    if (ex.type !== candidate.type) continue;
    if (Math.abs(Math.abs(ex.amount) - candAmount) > 0.001) continue;

    const exDate = new Date(ex.occurred_at).getTime();
    if (Math.abs(exDate - candDate) > threeDaysMs) continue;

    const exMerchant = ex.merchant ?? ex.description ?? '';
    if (!merchantsAreSimilar(candidate.merchant, exMerchant)) continue;

    return ex;
  }
  return null;
}

// ----------------------------------------------------------------
// External ID extraction
// ----------------------------------------------------------------
function findExternalIdColumn(headers: string[]): number {
  return findColumn(headers, [
    /transaction\s*id/i,
    /^reference$/i,
    /^ref(\.|erence)?\s*(number|#|id)?$/i,
    /^trans\.?\s*id$/i,
  ]);
}

// ----------------------------------------------------------------
// Rule matching — applied after merchant is cleaned.
//
// Matches against the lowercased merchant text using "contains" logic.
// This catches bank junk (store numbers, locations, order IDs) that
// gets appended to the merchant name. The rule's pattern should already
// be stored lowercase.
// ----------------------------------------------------------------
function findMatchingRule(
  merchant: string,
  rules: MerchantRuleLike[]
): MerchantRuleLike | null {
  if (!merchant || rules.length === 0) return null;
  const normalized = merchant.trim().toLowerCase();

  // Prefer exact match first, then fall back to contains.
  const exact = rules.find((r) => r.pattern === normalized);
  if (exact) return exact;

  // Find all contains matches, pick the longest pattern (most specific).
  const contains = rules
    .filter((r) => normalized.includes(r.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length);

  return contains[0] ?? null;
}

// ----------------------------------------------------------------
// Transfer detection
// ----------------------------------------------------------------
//
// Detects transactions that are likely transfers between the user's own
// accounts (credit card payments, loan payments, bank-to-bank transfers).
// These look like expenses by amount sign but should not count as spending.
//
// Examples this catches:
//   "Capital One Mobile Pmt"      -> contains 'pmt'
//   "Synchrony Bank Payment"      -> contains 'payment'
//   "Amficu Ck Webxfr Transfer"   -> contains 'transfer' AND 'webxfr'
//   "Jenius Bank TRANSFER"        -> contains 'transfer'
//   "Lightstream Loan Pmts"       -> contains 'loan' AND 'pmt'
//   "GreenSky WEB PAY"            -> contains 'web pay'
//   "Chase Card ePay"             -> contains 'epay'
//   "Discover ACH Pmt"            -> contains 'ach' AND 'pmt'
//
// We use word-boundary matching for short tokens like 'pmt' and 'ach' to
// avoid false positives (e.g., 'compatible' contains 'pat' as substring).
//
// IMPORTANT: This is a HEURISTIC. It may produce false positives. The
// import preview UI shows the detected type and lets the user override
// per row. Merchant rules (saved by the user) take priority over this
// detection — once a user saves a rule, that's the source of truth.
const TRANSFER_KEYWORDS = [
  // Whole word patterns (with \b boundaries below)
  'transfer',
  'xfer',
  'webxfr',
  'payment',
  'epay',
  'autopay',
  'ach',
  'pmt',
  'pmts',
  'wire',
  // Multi-word patterns that need looser matching
  'web pay',
  'mobile pmt',
  'online pmt',
  'card payment',
  'credit card payment',
  'loan payment',
];

function looksLikeTransfer(merchant: string): boolean {
  if (!merchant) return false;
  const normalized = ' ' + merchant.toLowerCase() + ' ';

  for (const keyword of TRANSFER_KEYWORDS) {
    if (keyword.includes(' ')) {
      // Multi-word: use simple substring (the spaces in the keyword
      // already provide some boundary protection)
      if (normalized.includes(' ' + keyword + ' ') ||
          normalized.includes(' ' + keyword)) {
        return true;
      }
    } else {
      // Single word: use word boundaries to avoid false positives
      // (e.g., 'pmt' shouldn't match 'compatible')
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(merchant)) return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------
// Main parser
// ----------------------------------------------------------------
export function parseCSV(text: string, rules: MerchantRuleLike[] = []): ParseResult {
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
  const externalIdCol = findExternalIdColumn(headers);

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
  if (externalIdCol !== -1) {
    detectedFormat += ' · with transaction IDs';
  }

  const rows: ParsedRow[] = [];
  const skipped: { row: string; reason: string }[] = [];

  for (let lineIdx = headerIdx + 1; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const cells = parseCSVLine(rawLine);

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

    const externalId =
      externalIdCol >= 0 && cells[externalIdCol]?.trim()
        ? cells[externalIdCol].trim()
        : null;

    const merchant = cleanMerchant(desc);

    // Sign-based default classification
    const signBasedType: 'income' | 'expense' = amount < 0 ? 'expense' : 'income';

    // Consult rules — if a rule matches, its type overrides everything else.
    // Rules are user-defined and take absolute priority.
    const matchedRule = findMatchingRule(merchant, rules);

    // If no rule, check for transfer keywords (auto-detection of payments,
    // bank transfers, etc.). This catches the common "credit card payment
    // double-counted as expense" problem before the sign-based fallback.
    let type: 'income' | 'expense' | 'transfer';
    let detectedAsTransfer = false;
    if (matchedRule) {
      type = matchedRule.type;
    } else if (looksLikeTransfer(merchant)) {
      type = 'transfer';
      detectedAsTransfer = true;
    } else {
      type = signBasedType;
    }

    rows.push({
      occurred_at: date.toISOString(),
      merchant,
      amount: Math.abs(amount),
      type,
      external_id: externalId,
      fingerprint: '',
      raw: rawLine,
      matchedRuleId: matchedRule?.id ?? null,
      suggestedCategoryId: matchedRule?.category_id ?? null,
      autoDetectedTransfer: detectedAsTransfer,
    });
  }

  return { rows, skipped, detectedFormat, rawHeaders: headers };
}

// ----------------------------------------------------------------
// Merchant cleaner
// ----------------------------------------------------------------
function cleanMerchant(raw: string): string {
  let s = raw.trim();

  s = s.split(/\s+REF\s*#/i)[0];
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  s = s.replace(/\s+#\d+.*/, '');
  s = s.replace(/\s+\*[A-Z0-9]{6,}.*/i, '');
  s = s.replace(/\s+\d{5,}.*/, '');
  s = s.replace(/\s+PPD\d+.*/i, '');
  s = s.replace(/\s+WEB\d+.*/i, '');
  s = s.replace(/\s+\d{2}-\d{7}.*/, '');
  s = s.replace(/\s+[A-Z]{2,3}\d+.*/, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/\s+[A-Z]{2}\s*$/, '');
  s = s.replace(/\s+\d{5}(-\d{4})?$/, '');

  if (s.length > 40) {
    s = s.slice(0, 40).trim();
  }

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
