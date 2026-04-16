import { ReactNode } from 'react';

interface Props {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: string;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
}

export default function StatCard({ title, value, icon, color, subtitle, trend }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color} flex-shrink-0`}>
          {icon}
        </div>
        <div className="text-right">
          <p className="text-xs text-brand-500 font-semibold uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-brand-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center justify-end gap-1 mt-1.5 text-xs font-semibold ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)} هذا الشهر</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
