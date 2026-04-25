// Target path: components/ui/month-picker.tsx (NEW FILE)

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from 'date-fns';

interface MonthPickerProps {
  /** The currently displayed month (already parsed from URL or current) */
  current: Date;
  /** Optional: minimum date users can navigate to (e.g., earliest tx date) */
  earliest?: Date;
}

export function MonthPicker({ current, earliest }: MonthPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const today = startOfMonth(new Date());
  const isCurrentMonth = isSameMonth(current, today);

  // Disable next button if we're at the current month (no future)
  const canGoNext = !isCurrentMonth;
  const canGoPrev = earliest ? !isSameMonth(current, earliest) && current > earliest : true;

  function navigate(target: Date) {
    const newParams = new URLSearchParams(params.toString());
    if (isSameMonth(target, today)) {
      // No query param needed for current month — keeps URLs clean
      newParams.delete('month');
    } else {
      newParams.set('month', format(target, 'yyyy-MM'));
    }
    const queryString = newParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      <button
        type="button"
        onClick={() => navigate(subMonths(current, 1))}
        disabled={!canGoPrev}
        className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Previous month"
      >
        <ChevronLeft size={15} strokeWidth={1.75} />
      </button>

      <button
        type="button"
        onClick={() => navigate(today)}
        disabled={isCurrentMonth}
        className="min-w-[8rem] px-3 py-1 text-center text-sm font-medium tabular text-foreground transition-colors hover:bg-subtle/40 rounded-md disabled:cursor-default disabled:hover:bg-transparent"
        title={isCurrentMonth ? 'Current month' : 'Jump to current month'}
      >
        {format(current, 'MMMM yyyy')}
      </button>

      <button
        type="button"
        onClick={() => navigate(addMonths(current, 1))}
        disabled={!canGoNext}
        className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next month"
      >
        <ChevronRight size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/**
 * Parse a month query parameter ("2026-03") into a Date.
 * Returns startOfMonth(now) if invalid or missing.
 */
export function parseMonthParam(value: string | undefined | null): Date {
  if (!value) return startOfMonth(new Date());
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return startOfMonth(new Date());
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return startOfMonth(new Date());
  }
  return new Date(year, month - 1, 1);
}
