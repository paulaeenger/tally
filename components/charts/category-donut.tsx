'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils/cn';

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

interface CategoryDonutProps {
  data: CategorySlice[];
  total: number;
}

export function CategoryDonut({ data, total }: CategoryDonutProps) {
  return (
    <div className="relative h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={1.5}
            stroke="rgb(var(--surface))"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'rgb(var(--elevated))',
              border: '1px solid rgb(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              padding: '8px 12px',
            }}
            formatter={(v: number) => formatCurrency(v)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
          Month-to-date
        </span>
        <span className="mt-1 font-display text-2xl tabular text-foreground">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
