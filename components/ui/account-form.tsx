'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { createAccount, updateAccount, archiveAccount } from '@/app/actions/accounts';
import type { Account, AccountType } from '@/lib/data/types';
import { cn } from '@/lib/utils/cn';

const ACCOUNT_TYPES: { value: AccountType; label: string; hint: string }[] = [
  { value: 'checking', label: 'Checking', hint: 'Everyday spending' },
  { value: 'savings', label: 'Savings', hint: 'Emergency fund, reserves' },
  { value: 'credit', label: 'Credit Card', hint: 'Balances owed' },
  { value: 'investment', label: 'Investment', hint: 'Brokerage, 401k, IRA' },
  { value: 'cash', label: 'Cash', hint: 'Physical currency' },
  { value: 'loan', label: 'Loan', hint: 'Mortgage, student loan' },
];

interface AccountFormProps {
  open: boolean;
  onClose: () => void;
  editing?: Account | null;
}

export function AccountForm({ open, onClose, editing }: AccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editing;
  // For credit/loan accounts, show balance as positive (it's "amount owed")
  const displayBalance = editing
    ? editing.type === 'credit' || editing.type === 'loan'
      ? Math.abs(Number(editing.balance))
      : Number(editing.balance)
    : '';

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const action = isEdit ? updateAccount : createAccount;
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

  async function handleArchive() {
    if (!editing) return;
    if (!confirm(`Archive "${editing.name}"? It won't show up in totals but can be restored later.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await archiveAccount(editing.id);
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
      title={isEdit ? 'Edit account' : 'Add an account'}
      description={
        isEdit
          ? 'Update the details of this account.'
          : 'Add a checking, savings, credit, or investment account.'
      }
    >
      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="label mb-1.5 block">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={editing?.name}
            autoFocus={!isEdit}
            placeholder="Everyday Checking"
            className="input"
          />
        </div>

        <div>
          <label className="label mb-2 block">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPES.map((t) => (
              <label
                key={t.value}
                className="relative cursor-pointer rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-subtle has-[:checked]:border-accent has-[:checked]:bg-subtle"
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  required
                  defaultChecked={editing ? editing.type === t.value : t.value === 'checking'}
                  className="sr-only"
                />
                <div className="text-sm font-medium text-foreground">{t.label}</div>
                <div className="mt-0.5 text-xs text-muted">{t.hint}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="institution" className="label mb-1.5 block">
            Institution <span className="text-faint normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="institution"
            name="institution"
            type="text"
            defaultValue={editing?.institution ?? ''}
            placeholder="Chase, Wells Fargo, Fidelity…"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="balance" className="label mb-1.5 block">
            Current balance
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            <input
              id="balance"
              name="balance"
              type="number"
              step="0.01"
              required
              defaultValue={displayBalance}
              placeholder="0.00"
              className="input pl-7 tabular"
              inputMode="decimal"
            />
          </div>
          <p className="mt-1.5 text-xs text-faint">
            For credit cards and loans, enter the amount owed as a positive number.
          </p>
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
              onClick={handleArchive}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-negative transition-colors hover:bg-negative/5"
            >
              Archive
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? (
                <Loader2 size={15} className="animate-spin" strokeWidth={2} />
              ) : isEdit ? null : (
                <Plus size={15} strokeWidth={2} />
              )}
              {isEdit ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
