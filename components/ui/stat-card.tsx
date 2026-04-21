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
    <div className={cn('card p-5 sm:p-6 min-w-0', className)}>
      <p className="label truncate">{label}</p>
      <p className="mt-2 font-display font-normal tabular text-foreground truncate text-[clamp(1.25rem,2.6vw,1.875rem)] leading-tight">
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
