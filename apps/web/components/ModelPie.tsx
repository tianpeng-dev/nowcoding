'use client';

import { getAiCodingThemeColor } from '@/lib/chart-theme';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface ModelSlice {
  model: string;
  tokens: number;
}

export function ModelPie({
  data,
  emptyLabel = 'No models yet.',
  valueLabel = 'tokens',
}: {
  data: ModelSlice[];
  emptyLabel?: string;
  valueLabel?: string;
}) {
  if (data.length === 0) return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  const top = data.slice(0, 5);
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={top}
            dataKey="tokens"
            nameKey="model"
            outerRadius={64}
            innerRadius={32}
            paddingAngle={1}
          >
            {top.map((slice) => (
              <Cell key={slice.model} fill={getAiCodingThemeColor(slice.model)} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'rgba(0,0,0,0.85)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: '#f5f5f5' }}
            itemStyle={{ color: '#f5f5f5' }}
            formatter={(v: number, name: string) => [`${v.toLocaleString()} ${valueLabel}`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
