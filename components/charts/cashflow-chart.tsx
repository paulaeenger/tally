'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatCompact, formatCurrency } from '@/lib/utils/cn';

export interface CashflowPoint {
  date: string;
  income: number;
  expense: number;
  net: number;
}

interface CashflowChartProps {
  data: CashflowPoint[];
}

export function CashflowChart({ data }: CashflowChartProps) {
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--positive))" stopOpacity={0.22} />
              <stop offset="100%" stopColor="rgb(var(--positive))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--negative))" stopOpacity={0.18} />
              <stop offset="100%" stopColor="rgb(var(--negative))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="rgb(var(--faint))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            stroke="rgb(var(--faint))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${formatCompact(v)}`}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: 'rgb(var(--muted))', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'rgb(var(--surface))',
              border: '1px solid rgb(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              padding: '8px 12px',
              color: 'rgb(var(--foreground))',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            }}
            itemStyle={{ color: 'rgb(var(--foreground))' }}
            labelStyle={{ color: 'rgb(var(--muted))', marginBottom: 4 }}
            formatter={(v: number) => formatCurrency(v)}
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="rgb(var(--positive))"
            strokeWidth={1.75}
            fill="url(#incomeGradient)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="rgb(var(--negative))"
            strokeWidth={1.75}
            fill="url(#expenseGradient)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
