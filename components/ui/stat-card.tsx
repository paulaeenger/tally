import { cn } from '@/lib/utils/cn';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  change?: { value: number; label?: string };
  trend?: 'positive' | 'negative' | 'neutral';
  footnote?: string;
  className?: string;
}

export function StatCard({ label, value, change, trend, footnote, className }: StatCardProps) {
  const isPositive = change && change.value >= 0;
  const trendColor =
    trend === 'positive'
      ? 'text-positive'
      : trend === 'negative'
        ? 'text-negative'
        : isPositive
          ? 'text-positive'
          : 'text-negative';

  return (
    <div className={cn('card p-5 sm:p-6 min-w-0 overflow-hidden', className)}>
      <p className="label truncate">{label}</p>
      {/*
        Font size scales fluidly with the card's available width.
        min 1.125rem (18px) is enough to fit even long values like "$12,500.00".
        Using white-space: nowrap + overflow: hidden lets it stay on one line
        without the "…" truncation ellipsis.
      */}
      <p
        className="mt-2 font-display font-normal tabular text-foreground leading-tight"
        style={{
          fontSize: 'clamp(1.125rem, 2.2vw, 1.875rem)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {value}
      </p>
      {(change || footnote) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {change && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium tabular shrink-0', trendColor)}>
              {isPositive ? (
                <ArrowUpRight size={12} strokeWidth={2} />
              ) : (
                <ArrowDownRight size={12} strokeWidth={2} />
              )}
              {Math.abs(change.value).toFixed(1)}%
            </span>
          )}
          {change?.label && <span className="text-faint truncate">{change.label}</span>}
          {footnote && !change && <span className="text-faint truncate">{footnote}</span>}
        </div>
      )}
    </div>
  );
}
