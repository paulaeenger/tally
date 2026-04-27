'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { BudgetForm } from './budget-form';
import type { Budget, Category } from '@/lib/data/types';

interface Props {
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
}

export function AddBudgetButton({
  categories,
  label = 'New budget',
}: Props & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={2} />
        {label}
      </button>
      <BudgetForm open={open} onClose={() => setOpen(false)} categories={categories} />
    </>
  );
}

/**
 * Budget card wrapper.
 *
 * Layout:
 *   - Whole card body is a Link to the filtered transactions for this
 *     budget's category & period (primary action — viewing what you spent).
 *   - A small pencil icon in the top-right opens the edit modal (secondary
 *     action — changing the budget amount).
 *
 * If `txUrl` is null (no category, can't filter), the whole card opens the
 * edit modal (preserves the old behavior so users without categories still
 * have access to editing).
 */
export function EditableBudgetCard({
  budget,
  categories,
  txUrl,
  children,
}: Props & {
  budget: Budget;
  txUrl: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // If no transactions URL (budget has no category), fall back to old
  // behavior — whole card opens the edit modal.
  if (!txUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-left transition-colors hover:border-foreground/20"
        >
          {children}
        </button>
        <BudgetForm
          open={open}
          onClose={() => setOpen(false)}
          categories={categories}
          editing={budget}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <Link
          href={txUrl}
          className="block text-left transition-colors hover:border-foreground/20"
        >
          {children}
        </Link>
        {/* Edit button — absolutely positioned in the top-right corner so
            it doesn't disrupt the card's content layout. Higher z-index
            so it sits above the Link's tap target. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
          }}
          className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground transition-colors"
          aria-label="Edit budget"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
      </div>
      <BudgetForm
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        editing={budget}
      />
    </>
  );
}
