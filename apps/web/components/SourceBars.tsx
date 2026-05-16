'use client';

import { getAiCodingThemeColor, themeColorToRgba } from '@/lib/chart-theme';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface SourceSlice {
  source: string;
  tokens: number;
}

export function SourceBars({ data }: { data: SourceSlice[] }) {
  if (data.length === 0) return <p className="text-sm text-neutral-500">No tools yet.</p>;
  const top = data.slice(0, 8);
  const activeColor = getAiCodingThemeColor(top[0]?.source ?? '');
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
          <XAxis
            type="number"
            stroke="#a3a3a3"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatShort(v)}
          />
          <YAxis
            type="category"
            dataKey="source"
            stroke="#a3a3a3"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            cursor={{ fill: themeColorToRgba(activeColor, 0.12) }}
            contentStyle={{
              background: 'rgba(0,0,0,0.85)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: '#f5f5f5' }}
            itemStyle={{ color: '#f5f5f5' }}
            formatter={(v: number) => [`${v.toLocaleString()} tokens`, 'tokens']}
          />
          <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
            {top.map((slice) => (
              <Cell key={slice.source} fill={getAiCodingThemeColor(slice.source)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}
