'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface SparklinePoint {
  date: string;
  tokens: number;
}

export function SparklineChart({
  data,
  emptyLabel = 'No activity yet.',
  valueLabel = 'tokens',
}: {
  data: SparklinePoint[];
  emptyLabel?: string;
  valueLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#a3a3a3"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatShort(v)}
          />
          <Tooltip
            cursor={{ stroke: '#7c3aed', strokeOpacity: 0.2 }}
            contentStyle={{
              background: 'rgba(0,0,0,0.85)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: '#f5f5f5' }}
            itemStyle={{ color: '#f5f5f5' }}
            formatter={(v: number) => [formatShort(v), valueLabel]}
          />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="url(#tokenFill)"
          />
        </AreaChart>
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
