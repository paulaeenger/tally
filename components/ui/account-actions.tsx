'use client';

import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { AccountForm } from './account-form';
import type { Account } from '@/lib/data/types';

export function AddAccountButton({ label = 'Link account' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={2} />
        {label}
      </button>
      <AccountForm open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function EditAccountButton({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-subtle hover:text-foreground group-hover:opacity-100"
        aria-label={`Edit ${account.name}`}
      >
        <Pencil size={14} strokeWidth={1.5} />
      </button>
      <AccountForm
        open={open}
        onClose={() => setOpen(false)}
        editing={account}
      />
    </>
  );
}
