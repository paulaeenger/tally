// Target path in your repo: components/ui/csv-import-modal.tsx (REPLACE existing file)

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, AlertCircle, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/modal';
import { parseCSV, computeFingerprint, type ParsedRow, type MerchantRuleLike } from '@/lib/utils/csv-parser';
import { bulkImportTransactions } from '@/app/actions/transactions';
import { checkForDuplicates } from '@/app/actions/transactions-check';
import {
  getMerchantRules,
  upsertMerchantRule,
  incrementRuleMatches,
  type MerchantRule,
} from '@/app/actions/merchant-rules';
import type { Account, Category, TransactionType } from '@/lib/data/types';
import { cn, formatCurrency } from '@/lib/utils/cn';

type Stage = 'upload' | 'preview' | 'done';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Pick<Account, 'id' | 'name' | 'type'>[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
}

interface PreviewRow extends ParsedRow {
  isDuplicate: boolean;
  dupReason: 'external_id' | 'fingerprint' | null;
  // User can override the type and category in the review UI
  userType: TransactionType;
  userCategoryId: string | null;
  // If true, user wants to save this row's type/category as a rule
  saveAsRule: boolean;
}

export function CsvImportModal({ open, onClose, accounts, categories }: ImportModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [skipped, setSkipped] = useState<{ row: string; reason: string }[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string>('');
  // Default to "Zions Checking" if it exists in the user's accounts.
  // This is more useful than picking the first account alphabetically,
  // since most imports go to the primary checking account anyway.
  // localStorage memory (loaded in a useEffect below) overrides this if
  // the user has imported into a different account previously.
  const defaultAccountId =
    accounts.find((a) => a.name.toLowerCase() === 'zions checking')?.id
    ?? accounts[0]?.id
    ?? '';
  const [accountId, setAccountId] = useState<string>(defaultAccountId);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCheckingDupes, setIsCheckingDupes] = useState(false);
  const [rules, setRules] = useState<MerchantRule[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    rulesSaved: number;
  }>({
    imported: 0,
    skipped: 0,
    rulesSaved: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Load existing merchant rules when the modal opens. These are used
  // by the parser to pre-fill type/category suggestions for known merchants.
  //
  // Note: handleFile also re-fetches rules if they haven't loaded yet,
  // so the parsing is always correct even if the user drops a file very
  // quickly after opening the modal.
  const [rulesLoaded, setRulesLoaded] = useState(false);
  useEffect(() => {
    if (!open) return;
    setRulesLoaded(false);
    (async () => {
      const r = await getMerchantRules();
      setRules(r);
      setRulesLoaded(true);
    })();
  }, [open]);

  // Remember the last account used for CSV import. We read from localStorage
  // when the modal opens and pre-select that account. The user can still
  // override per-import, but the common case (always importing into the
  // same account) just works without picking each time.
  useEffect(() => {
    if (!open) return;
    if (accounts.length === 0) return;
    try {
      const stored = window.localStorage.getItem('tally:lastImportAccount');
      if (stored && accounts.some((a) => a.id === stored)) {
        setAccountId(stored);
      }
    } catch {
      // localStorage might be unavailable (incognito, sandbox iframes, etc.).
      // Fall back silently to the default already set in useState.
    }
  }, [open, accounts]);

  function reset() {
    setStage('upload');
    setFileName('');
    setParsed([]);
    setPreview([]);
    setSkipped([]);
    setDetectedFormat('');
    setExcludedRows(new Set());
    setError(null);
    setImportResult({ imported: 0, skipped: 0, rulesSaved: 0 });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      setError('Please upload a CSV file.');
      return;
    }
    const text = await file.text();

    // Auto-detect account from filename. Match the filename against account
    // names (case-insensitive, ignoring non-alphanumerics on both sides).
    // E.g., "wells_fargo_2026-04.csv" matches account "Wells Fargo Checking".
    // If a match is found, override the currently-selected account.
    const normalizedName = file.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedAccount = accounts.find((a) => {
      const acctName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Match if either the account name appears in the filename, OR
      // if a meaningful chunk of the account name matches. Avoid matching
      // very short tokens like "x" or "1" by requiring 4+ chars.
      if (acctName.length >= 4 && normalizedName.includes(acctName)) return true;
      // Also try: any word in the account name appears in the filename
      const words = a.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
      return words.some((w) => normalizedName.includes(w));
    });
    if (matchedAccount && matchedAccount.id !== accountId) {
      setAccountId(matchedAccount.id);
    }

    // Ensure rules are loaded before parsing. If the user dropped a file
    // faster than the rules could load (rare but possible), fetch them now
    // so the first parse isn't missing rule matches.
    let rulesForParse: MerchantRule[] = rules;
    if (!rulesLoaded) {
      rulesForParse = await getMerchantRules();
      setRules(rulesForParse);
      setRulesLoaded(true);
    }

    // Convert DB rules to the parser's expected shape
    const parserRules: MerchantRuleLike[] = rulesForParse.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      type: r.type,
      category_id: r.category_id,
    }));

    const result = parseCSV(text, parserRules);
    if (result.rows.length === 0) {
      setError(
        `No importable rows found. ${
          result.skipped.length > 0 ? `${result.skipped.length} row(s) skipped.` : ''
        }`
      );
      return;
    }
    setFileName(file.name);
    setParsed(result.rows);
    setSkipped(result.skipped);
    setDetectedFormat(result.detectedFormat);
    setStage('preview');
  }

  // When the account or parsed rows change, recompute fingerprints and
  // check the DB for matches. The DB unique indexes are the real safety
  // net — this is just a UX nicety that pre-flags dupes in the preview.
  useEffect(() => {
    if (parsed.length === 0 || !accountId) {
      setPreview([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsCheckingDupes(true);

      const enriched: PreviewRow[] = parsed.map((r) => ({
        ...r,
        fingerprint: computeFingerprint({
          occurredAt: r.occurred_at,
          amount: r.amount,
          merchant: r.merchant,
          type: r.type,
        }),
        isDuplicate: false,
        dupReason: null,
        // User overrides default to whatever the parser chose (may be
        // rule-informed or sign-based)
        userType: r.type,
        userCategoryId: r.suggestedCategoryId ?? null,
        // Default: don't re-save rules that already exist. Only offer to
        // save if nothing matched. User can toggle.
        saveAsRule: !r.matchedRuleId,
      }));

      const dates = parsed.map((r) => new Date(r.occurred_at).getTime());
      const fromDate = new Date(Math.min(...dates)).toISOString();
      const toDate = new Date(Math.max(...dates) + 24 * 60 * 60 * 1000).toISOString();

      const externalIds = enriched
        .map((r) => r.external_id)
        .filter((id): id is string => !!id);
      const fingerprints = enriched.map((r) => r.fingerprint);

      try {
        const existing = await checkForDuplicates({
          accountId,
          fromDate,
          toDate,
          externalIds,
          fingerprints,
        });

        if (cancelled) return;

        const flagged: PreviewRow[] = enriched.map((r) => {
          if (r.external_id && existing.externalIds.includes(r.external_id)) {
            return { ...r, isDuplicate: true, dupReason: 'external_id' };
          }
          if (existing.fingerprints.includes(r.fingerprint)) {
            return { ...r, isDuplicate: true, dupReason: 'fingerprint' };
          }
          return r;
        });

        setPreview(flagged);

        const newExcluded = new Set<number>();
        flagged.forEach((r, i) => {
          if (r.isDuplicate) newExcluded.add(i);
        });
        setExcludedRows(newExcluded);
      } catch (err) {
        if (!cancelled) {
          setPreview(enriched);
          setExcludedRows(new Set());
        }
      } finally {
        if (!cancelled) setIsCheckingDupes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed, accountId]);

  function toggleRow(idx: number) {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function updateRowType(idx: number, newType: TransactionType) {
    setPreview((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, userType: newType } : r))
    );
  }

  // Reserved for future per-row category dropdown. Currently rules-applied
  // and default categories are used instead.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function updateRowCategory(idx: number, newCategoryId: string | null) {
    setPreview((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, userCategoryId: newCategoryId } : r))
    );
  }

  function toggleSaveAsRule(idx: number) {
    setPreview((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, saveAsRule: !r.saveAsRule } : r))
    );
  }

  const includedRows = useMemo(
    () => preview.filter((_, i) => !excludedRows.has(i)),
    [preview, excludedRows]
  );

  const duplicateCount = useMemo(
    () => preview.filter((r) => r.isDuplicate).length,
    [preview]
  );

  const rulesToSaveCount = useMemo(
    () =>
      preview.filter((r, i) => r.saveAsRule && !excludedRows.has(i)).length,
    [preview, excludedRows]
  );

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;
    for (const r of includedRows) {
      if (r.userType === 'income') income += r.amount;
      else if (r.userType === 'expense') expense += r.amount;
      else transfer += r.amount;
    }
    return { income, expense, transfer, count: includedRows.length };
  }, [includedRows]);

  async function handleImport() {
    if (!accountId) {
      setError('Select an account.');
      return;
    }
    if (includedRows.length === 0) {
      setError('No rows selected for import.');
      return;
    }

    setError(null);
    startTransition(async () => {
      // 1. Import transactions with user-overridden type/category
      const result = await bulkImportTransactions(
        includedRows.map((r) => ({
          occurred_at: r.occurred_at,
          merchant: r.merchant,
          amount: r.amount,
          type: r.userType, // user override (defaults to parser's guess)
          account_id: accountId,
          category_id: r.userCategoryId || defaultCategoryId || null,
          external_id: r.external_id,
          notes: null,
        }))
      );
      if (result.error) {
        setError(result.error);
        return;
      }

      // 2. Save/update rules for rows where user checked "save as rule"
      const rowsToSaveAsRule = includedRows.filter((r) => r.saveAsRule);
      let rulesSaved = 0;
      for (const r of rowsToSaveAsRule) {
        const ruleResult = await upsertMerchantRule({
          pattern: r.merchant.trim().toLowerCase(),
          type: r.userType,
          category_id: r.userCategoryId || null,
        });
        if (!ruleResult.error) rulesSaved++;
      }

      // 3. Bump match counts for any rules that were applied during parsing
      const matchedRuleIds = includedRows
        .map((r) => r.matchedRuleId)
        .filter((id): id is string => !!id);
      if (matchedRuleIds.length > 0) {
        await incrementRuleMatches(matchedRuleIds);
      }

      setImportResult({
        imported: result.imported,
        skipped: result.skipped,
        rulesSaved,
      });

      // Remember this account for next time. Failure here is silent —
      // localStorage might be unavailable in some browser contexts.
      try {
        window.localStorage.setItem('tally:lastImportAccount', accountId);
      } catch {
        // ignored
      }

      setStage('done');
      router.refresh();
    });
  }

  if (accounts.length === 0) {
    return (
      <Modal open={open} onClose={handleClose} title="Import transactions" description="Add an account first.">
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted">
            You need at least one account before you can import transactions. Close this
            and add an account from the Accounts tab.
          </p>
          <div className="flex justify-end">
            <button onClick={handleClose} className="btn-primary">
              OK, got it
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        stage === 'upload' ? 'Import transactions' :
        stage === 'preview' ? 'Review & import' :
        'Import complete'
      }
      description={
        stage === 'upload'
          ? 'Upload a CSV file from your bank or credit card.'
          : stage === 'preview'
            ? `${detectedFormat}${fileName ? ' · ' + fileName : ''}`
            : 'Your transactions have been added.'
      }
      className="sm:max-w-3xl"
    >
      {stage === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
              dragOver
                ? 'border-accent bg-subtle'
                : 'border-border bg-subtle/40 hover:bg-subtle/80'
            )}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <Upload size={20} strokeWidth={1.5} />
            </div>
            <p className="font-display text-lg text-foreground">Drop a CSV here</p>
            <p className="mt-1 text-sm text-muted">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="hidden"
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 text-xs text-muted">
            <p className="mb-2 font-medium text-foreground">Supported formats</p>
            <ul className="space-y-1">
              <li>Chase · Wells Fargo · Bank of America · American Express</li>
              <li>Any CSV with Date, Description, and Amount columns</li>
            </ul>
            <p className="mt-3 text-faint">
              Tip: we'll auto-skip duplicates if you re-import a file that overlaps a
              previous one.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
              <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {stage === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label mb-1.5 block">Import into account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">
                Default category{' '}
                <span className="text-faint normal-case tracking-normal">(optional)</span>
              </label>
              <select
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
                className="input"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="chip">
              <FileText size={11} strokeWidth={1.75} />
              {summary.count} to import
            </span>
            {summary.income > 0 && (
              <span className="chip text-positive">
                +{formatCurrency(summary.income)} income
              </span>
            )}
            {summary.expense > 0 && (
              <span className="chip text-negative">
                −{formatCurrency(summary.expense)} expenses
              </span>
            )}
            {summary.transfer > 0 && (
              <span className="chip text-muted">
                {formatCurrency(summary.transfer)} transfers
              </span>
            )}
            {duplicateCount > 0 && (
              <span className="chip text-warning">
                <AlertTriangle size={11} strokeWidth={1.75} />
                {duplicateCount} likely duplicate{duplicateCount === 1 ? '' : 's'}
              </span>
            )}
            {skipped.length > 0 && (
              <span className="chip text-faint">{skipped.length} unparseable</span>
            )}
            {isCheckingDupes && (
              <span className="chip text-muted">
                <Loader2 size={11} className="animate-spin" strokeWidth={1.75} />
                Checking for duplicates…
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-xs text-faint">
                  <th className="w-10 px-2 py-2"></th>
                  <th className="px-2 py-2 text-left font-medium">Date</th>
                  <th className="px-2 py-2 text-left font-medium">Merchant</th>
                  <th className="px-2 py-2 text-right font-medium">Amount</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th
                    className="px-2 py-2 text-center font-medium"
                    title="When checked, the app will remember this merchant's type for future imports."
                  >
                    Save rule
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => {
                  const excluded = excludedRows.has(i);
                  return (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-border/60 transition-opacity',
                        excluded && 'opacity-40',
                        r.isDuplicate && 'bg-warning/5'
                      )}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={() => toggleRow(i)}
                          aria-label={`Include ${r.merchant}`}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-muted tabular">
                        {format(new Date(r.occurred_at), 'MMM d')}
                      </td>
                      <td className="px-2 py-2 text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{r.merchant}</span>
                          {r.matchedRuleId && (
                            <Sparkles
                              size={11}
                              strokeWidth={1.75}
                              className="shrink-0 text-accent"
                              aria-label="Matched a saved rule"
                            />
                          )}
                          {r.isDuplicate && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                              title={
                                r.dupReason === 'external_id'
                                  ? 'Same transaction ID already in your account'
                                  : 'Same date, merchant, and amount as an existing transaction'
                              }
                            >
                              <AlertTriangle size={9} strokeWidth={2} />
                              Dup
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-2 py-2 text-right font-medium tabular',
                          r.userType === 'income'
                            ? 'text-positive'
                            : r.userType === 'transfer'
                              ? 'text-muted'
                              : 'text-foreground'
                        )}
                      >
                        {r.userType === 'income'
                          ? '+'
                          : r.userType === 'transfer'
                            ? ''
                            : '−'}
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={r.userType}
                          onChange={(e) =>
                            updateRowType(i, e.target.value as TransactionType)
                          }
                          disabled={excluded}
                          className="w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={r.saveAsRule}
                          onChange={() => toggleSaveAsRule(i)}
                          disabled={excluded}
                          aria-label={`Save rule for ${r.merchant}`}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rulesToSaveCount > 0 && (
            <p className="flex items-start gap-2 text-xs text-muted">
              <Sparkles size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
              <span>
                {rulesToSaveCount} rule{rulesToSaveCount === 1 ? '' : 's'} will be saved
                so the app remembers these merchants for future imports.
              </span>
            </p>
          )}

          {duplicateCount > 0 && (
            <p className="text-xs text-muted">
              Duplicates have been unchecked automatically. You can re-check any row
              that's actually a new transaction — the import will still skip true
              duplicates on the way into the database.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
              <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setStage('upload')}
              disabled={isPending}
              className="btn-ghost"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending || includedRows.length === 0}
              className="btn-primary"
            >
              {isPending && <Loader2 size={15} className="animate-spin" strokeWidth={2} />}
              Import {includedRows.length} transaction{includedRows.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="space-y-5 py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-positive/10 text-positive">
            <Check size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-display text-2xl text-foreground">
              {importResult.imported} transaction{importResult.imported === 1 ? '' : 's'} imported
            </p>
            {importResult.skipped > 0 && (
              <p className="mt-1 text-sm text-muted">
                {importResult.skipped} duplicate{importResult.skipped === 1 ? '' : 's'} skipped automatically.
              </p>
            )}
            {importResult.rulesSaved > 0 && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted">
                <Sparkles size={13} strokeWidth={1.75} className="text-accent" />
                {importResult.rulesSaved} rule{importResult.rulesSaved === 1 ? '' : 's'} saved
                for next time.
              </p>
            )}
            {importResult.skipped === 0 && importResult.rulesSaved === 0 && (
              <p className="mt-1 text-sm text-muted">Head to the dashboard to see them.</p>
            )}
          </div>
          <button onClick={handleClose} className="btn-primary">
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
