interface Props {
  label: string;
  value: number | string;
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
  hint?: string;
}

const TONES: Record<NonNullable<Props['tone']>, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function KpiCard({ label, value, tone = 'neutral', hint }: Props) {
  return (
    <div className={`rounded-lg border p-4 ${TONES[tone]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-3xl font-extrabold mt-2 tabular-nums">{value}</div>
      {hint && <div className="text-xs mt-1 opacity-70">{hint}</div>}
    </div>
  );
}
