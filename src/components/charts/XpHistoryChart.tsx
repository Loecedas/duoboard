import React, { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DuoColors } from '../../styles/duolingoColors';
import { useResolvedTheme } from '../../hooks/useResolvedTheme';

export interface XpHistoryChartProps {
  data: { date: string; xp: number }[];
}

const dotStyle = { r: 3, fill: DuoColors.featherGreen, strokeWidth: 2, stroke: '#fff' } as const;
const activeDotStyle = { r: 5 } as const;

function XpHistoryChart({ data }: XpHistoryChartProps): React.ReactElement {
  const totalXp = useMemo(() => data.reduce((sum, d) => sum + d.xp, 0), [data]);
  const gradientId = useId();
  const theme = useResolvedTheme();
  const isDark = theme === 'dark';

  const tooltipStyle = {
    borderRadius: '12px',
    border: isDark ? '1px solid rgba(71, 85, 105, 0.8)' : 'none',
    boxShadow: isDark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.1)',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#e5e7eb' : '#111827',
    fontSize: 12
  } as const;

  return (
    <div className="chart-shell w-full min-w-0">
      <div className="h-40 w-full min-w-0" style={{ minHeight: '160px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id={`xpGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={DuoColors.featherGreen} stopOpacity={0.3} />
                <stop offset="95%" stopColor={DuoColors.featherGreen} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e5e5e5'} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#6b7280', fontSize: 10 }} dy={5} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#6b7280', fontSize: 10 }} width={40} domain={[0, 'auto']} />
            <Tooltip
              contentStyle={tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: unknown) => [`${value as number} XP`, '经验値'] as any}
            />
            <Area
              type="monotone"
              dataKey="xp"
              stroke={DuoColors.featherGreen}
              strokeWidth={3}
              fill={`url(#xpGradient-${gradientId})`}
              dot={dotStyle}
              activeDot={activeDotStyle}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-xs text-gray-500 dark:text-slate-400 pb-3">
        本周共获得 <span style={{ color: DuoColors.featherGreen }} className="font-bold">{totalXp}</span> XP
      </div>
    </div>
  );
}

export default React.memo(XpHistoryChart);
