'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/app/actions/transactions';
import type { Account, Category, Transaction, TransactionType } from '@/lib/data/types';
import { cn } from '@/lib/utils/cn';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  accounts: Pick<Account, 'id' | 'name' | 'type'>[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
  editing?: Transaction | null;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

// Return a datetime-local compatible string (YYYY-MM-DDTHH:mm) from either an
// ISO date or nothing (for new transactions)
function toLocalDateTime(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function TransactionForm({
  open,
  onClose,
  accounts,
  categories,
  editing,
}: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'expense');

  const isEdit = !!editing;

  // If there are no accounts, block the form entirely with a helpful message
  if (accounts.length === 0) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Add a transaction"
        description="You'll need an account first."
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted">
            Transactions have to be tied to an account (checking, credit, etc). Add an
            account first, then come back here.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn-primary">
              OK, got it
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const action = isEdit ? updateTransaction : createTransaction;
      if (isEdit && editing) formData.set('id', editing.id);
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirm(`Delete this transaction? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTransaction(editing.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit transaction' : 'Add a transaction'}
      description={isEdit ? 'Update the details below.' : 'Log an expense, income, or transfer.'}
    >
      <form action={handleSubmit} className="space-y-5">
        {/* Type toggle */}
        <div>
          <label className="label mb-2 block">Type</label>
          <div className="flex gap-1 rounded-lg border border-border bg-subtle/60 p-1">
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors',
                  type === opt.value
                    ? 'bg-surface text-foreground shadow-subtle'
                    : 'text-muted hover:text-foreground'
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => setType(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Merchant + Amount side by side */}
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div>
            <label htmlFor="merchant" className="label mb-1.5 block">
              Merchant
            </label>
            <input
              id="merchant"
              name="merchant"
              type="text"
              required
              autoFocus={!isEdit}
              defaultValue={editing?.merchant ?? ''}
              placeholder="Whole Foods"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="amount" className="label mb-1.5 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={editing ? Number(editing.amount) : ''}
                placeholder="0.00"
                className="input pl-7 tabular"
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        {/* Account */}
        <div>
          <label htmlFor="account_id" className="label mb-1.5 block">
            Account
          </label>
          <select
            id="account_id"
            name="account_id"
            required
            defaultValue={editing?.account_id ?? accounts[0]?.id}
            className="input"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category — optional for transfers */}
        <div>
          <label htmlFor="category_id" className="label mb-1.5 block">
            Category{' '}
            {type === 'transfer' && (
              <span className="text-faint normal-case tracking-normal">(optional)</span>
            )}
          </label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={editing?.category_id ?? ''}
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

        {/* Date */}
        <div>
          <label htmlFor="occurred_at" className="label mb-1.5 block">
            When
          </label>
          <input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            required
            defaultValue={toLocalDateTime(editing?.occurred_at)}
            className="input"
          />
        </div>

        {/* Notes — optional */}
        <div>
          <label htmlFor="notes" className="label mb-1.5 block">
            Notes <span className="text-faint normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={editing?.notes ?? ''}
            placeholder="Anything worth remembering…"
            className="input resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
            {error}
          </div>
        )}

        <div
          className={cn(
            'flex gap-2 border-t border-border pt-4',
            isEdit ? 'justify-between' : 'justify-end'
          )}
        >
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-negative transition-colors hover:bg-negative/5"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Delete
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={isPending} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending && <Loader2 size={15} className="animate-spin" strokeWidth={2} />}
              {isEdit ? 'Save changes' : 'Add transaction'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
