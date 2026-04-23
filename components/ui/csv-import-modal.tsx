// Target path in your repo: components/ui/csv-import-modal.tsx (REPLACE existing file)

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, AlertCircle, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/modal';
import { parseCSV, computeFingerprint, type ParsedRow } from '@/lib/utils/csv-parser';
import { bulkImportTransactions } from '@/app/actions/transactions';
import { checkForDuplicates } from '@/app/actions/transactions-check';
import type { Account, Category } from '@/lib/data/types';
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
}

export function CsvImportModal({ open, onClose, accounts, categories }: ImportModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [skipped, setSkipped] = useState<{ row: string; reason: string }[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string>('');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCheckingDupes, setIsCheckingDupes] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number }>({
    imported: 0,
    skipped: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setStage('upload');
    setFileName('');
    setParsed([]);
    setPreview([]);
    setSkipped([]);
    setDetectedFormat('');
    setExcludedRows(new Set());
    setError(null);
    setImportResult({ imported: 0, skipped: 0 });
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
    const result = parseCSV(text);
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
          accountId,
          occurredAt: r.occurred_at,
          amount: r.amount,
          merchant: r.merchant,
          type: r.type,
        }),
        isDuplicate: false,
        dupReason: null,
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

  const includedRows = useMemo(
    () => preview.filter((_, i) => !excludedRows.has(i)),
    [preview, excludedRows]
  );

  const duplicateCount = useMemo(
    () => preview.filter((r) => r.isDuplicate).length,
    [preview]
  );

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of includedRows) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    }
    return { income, expense, count: includedRows.length };
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
      const result = await bulkImportTransactions(
        includedRows.map((r) => ({
          occurred_at: r.occurred_at,
          merchant: r.merchant,
          amount: r.amount,
          type: r.type,
          account_id: accountId,
          category_id: defaultCategoryId || null,
          external_id: r.external_id,
          notes: null,
        }))
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setImportResult({ imported: result.imported, skipped: result.skipped });
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
      className="sm:max-w-2xl"
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
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Merchant</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
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
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={() => toggleRow(i)}
                          aria-label={`Include ${r.merchant}`}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted tabular">
                        {format(new Date(r.occurred_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{r.merchant}</span>
                          {r.isDuplicate && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning"
                              title={
                                r.dupReason === 'external_id'
                                  ? 'Same transaction ID already in your account'
                                  : 'Same date, merchant, and amount as an existing transaction'
                              }
                            >
                              <AlertTriangle size={10} strokeWidth={2} />
                              Likely duplicate
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-medium tabular',
                          r.type === 'income' ? 'text-positive' : 'text-foreground'
                        )}
                      >
                        {r.type === 'income' ? '+' : '−'}
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
            {importResult.skipped === 0 && (
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
