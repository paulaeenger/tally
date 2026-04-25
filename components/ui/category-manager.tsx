// Target path: components/ui/category-manager.tsx (NEW FILE)

'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import {
  addCategory,
  updateCategory,
  deleteCategory,
  getCategoryUsage,
} from '@/app/actions/categories';
import type { Category } from '@/lib/data/types';

interface CategoryManagerProps {
  categories: Category[];
}

const PRESET_COLORS = [
  '#4a7c59', '#c45a3d', '#3d5a80', '#7d5ba6', '#8b7355',
  '#a64d79', '#2d6a6a', '#6b6863', '#c89960', '#5f8ca8',
  '#b57289', '#15803d', '#9c9891', '#5a3d80', '#80493d',
  '#3d8074', '#804d3d', '#3d6480', '#80553d', '#736b55',
];

type EditState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; category: Category }
  | { mode: 'delete'; category: Category };

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState>({ mode: 'closed' });

  function close() {
    setEdit({ mode: 'closed' });
    router.refresh();
  }

  return (
    <>
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-foreground">Categories</h3>
            <p className="text-xs text-muted">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEdit({ mode: 'add' })}
            className="btn-outline inline-flex items-center gap-1.5"
          >
            <Plus size={14} strokeWidth={2} />
            Add
          </button>
        </div>

        <ul className="divide-y divide-border">
          {categories.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">
              No categories yet. Add one to start organizing transactions.
            </li>
          ) : (
            categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: c.color }}
                />
                <span className="min-w-0 flex-1 text-sm text-foreground">
                  {c.name}
                  {c.is_refund && (
                    <span className="ml-2 rounded bg-positive/10 px-1.5 py-0.5 text-xs text-positive">
                      refund
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setEdit({ mode: 'edit', category: c })}
                  className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground"
                  title="Edit"
                >
                  <Pencil size={13} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setEdit({ mode: 'delete', category: c })}
                  className="rounded-md p-1.5 text-muted hover:bg-negative/10 hover:text-negative"
                  title="Delete"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {edit.mode === 'add' && (
        <CategoryForm
          mode="add"
          onClose={close}
        />
      )}

      {edit.mode === 'edit' && (
        <CategoryForm
          mode="edit"
          category={edit.category}
          onClose={close}
        />
      )}

      {edit.mode === 'delete' && (
        <DeleteCategoryModal
          category={edit.category}
          allCategories={categories}
          onClose={close}
        />
      )}
    </>
  );
}

function CategoryForm({
  mode,
  category,
  onClose,
}: {
  mode: 'add' | 'edit';
  category?: Category;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0]);
  const [isRefund, setIsRefund] = useState(category?.is_refund ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      if (mode === 'add') {
        const res = await addCategory({ name, color, is_refund: isRefund });
        if (res.error) setError(res.error);
        else onClose();
      } else if (category) {
        const res = await updateCategory({
          id: category.id,
          name,
          color,
          is_refund: isRefund,
        });
        if (res.error) setError(res.error);
        else onClose();
      }
    });
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={mode === 'add' ? 'Add category' : 'Edit category'}
    >
      <div className="space-y-5">
        <div>
          <label className="label mb-1.5 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pet Care"
            autoFocus
            maxLength={50}
            className="input"
          />
        </div>

        <div>
          <label className="label mb-1.5 block">Color</label>
          <div className="grid grid-cols-10 gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : ''
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="is_refund"
            checked={isRefund}
            onChange={(e) => setIsRefund(e.target.checked)}
            className="mt-0.5"
          />
          <label htmlFor="is_refund" className="text-sm text-foreground">
            <span className="font-medium">Refund category</span>
            <span className="block text-xs text-muted">
              Transactions in this category reduce spending instead of counting as expenses.
            </span>
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="btn-primary"
          >
            {isPending ? (
              <Loader2 size={15} className="animate-spin" strokeWidth={2} />
            ) : (
              <Check size={15} strokeWidth={2} />
            )}
            {mode === 'add' ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteCategoryModal({
  category,
  allCategories,
  onClose,
}: {
  category: Category;
  allCategories: Category[];
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<{
    transactions: number;
    budgets: number;
    rules: number;
  } | null>(null);
  const [reassignToId, setReassignToId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  // Fetch usage on mount
  useEffect(() => {
    let cancelled = false;
    getCategoryUsage(category.id).then((u) => {
      if (cancelled) return;
      setUsage({
        transactions: u.transactions,
        budgets: u.budgets,
        rules: u.rules,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [category.id]);

  const otherCategories = allCategories.filter((c) => c.id !== category.id);
  const hasUsage = usage && (usage.transactions > 0 || usage.budgets > 0);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCategory({
        id: category.id,
        reassignToId: reassignToId || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      const r = res.reassigned!;
      setResult(
        `Deleted. ${r.transactions} transaction${r.transactions === 1 ? '' : 's'} and ${r.budgets} budget${r.budgets === 1 ? '' : 's'} ${reassignToId ? 'reassigned' : 'uncategorized'}.`
      );
    });
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Delete "${category.name}"?`}
    >
      {result ? (
        <div className="space-y-5 py-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
            <Check size={22} strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted">{result}</p>
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {usage === null ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" />
              Checking usage…
            </div>
          ) : (
            <>
              {hasUsage ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                  <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <span>
                    This category is used by {usage.transactions} transaction
                    {usage.transactions === 1 ? '' : 's'}
                    {usage.budgets > 0
                      ? ` and ${usage.budgets} budget${usage.budgets === 1 ? '' : 's'}`
                      : ''}
                    .
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Not used by any transactions or budgets. Safe to delete.
                </p>
              )}

              {hasUsage && (
                <div>
                  <label className="label mb-1.5 block">
                    Reassign to (optional)
                  </label>
                  <select
                    value={reassignToId}
                    onChange={(e) => setReassignToId(e.target.value)}
                    className="input"
                  >
                    <option value="">Leave uncategorized</option>
                    {otherCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted">
                    {reassignToId
                      ? 'Transactions and budgets will be moved to the selected category.'
                      : 'Transactions will be uncategorized; budgets will lose their category link.'}
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-negative/30 bg-negative px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-negative/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 size={15} className="animate-spin" strokeWidth={2} />
                  ) : (
                    <Trash2 size={15} strokeWidth={2} />
                  )}
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
