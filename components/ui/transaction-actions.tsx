'use client';

import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { TransactionForm } from './transaction-form';
import { CsvImportModal } from './csv-import-modal';
import { TransactionRow } from './transaction-row';
import type { Account, Category, Transaction } from '@/lib/data/types';

interface ButtonProps {
  accounts: Pick<Account, 'id' | 'name' | 'type'>[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
}

export function AddTransactionButton({ accounts, categories, label = 'New' }: ButtonProps & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={2} />
        {label}
      </button>
      <TransactionForm
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}

export function ImportCsvButton({ accounts, categories }: ButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline">
        <Upload size={15} strokeWidth={2} />
        Import
      </button>
      <CsvImportModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}

/**
 * Makes an entire transaction row clickable to open the edit form.
 * Replaces the non-interactive <TransactionRow/> on the Transactions page.
 */
export function EditableTransactionRow({
  tx,
  accounts,
  categories,
  compact = false,
}: {
  tx: Transaction;
  accounts: Pick<Account, 'id' | 'name' | 'type'>[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left transition-colors hover:bg-subtle/50 rounded-md -mx-2 px-2"
      >
        <TransactionRow tx={tx} compact={compact} />
      </button>
      <TransactionForm
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
        editing={tx}
      />
    </>
  );
}
