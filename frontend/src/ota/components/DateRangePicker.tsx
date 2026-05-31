interface Props {
  from: Date;
  to: Date;
  onChange: (from: Date, to: Date) => void;
}

const PRESETS = [
  { label: '7 أيام', days: 7 },
  { label: '30 يوم', days: 30 },
  { label: '90 يوم', days: 90 },
];

export default function DateRangePicker({ from, to, onChange }: Props) {
  const applyPreset = (days: number) => {
    const newTo = new Date();
    const newFrom = new Date();
    newFrom.setDate(newFrom.getDate() - days);
    onChange(newFrom, newTo);
  };
  return (
    <div className="flex items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => applyPreset(p.days)}
          className="px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        >
          {p.label}
        </button>
      ))}
      <span className="text-xs text-slate-500 mr-2">
        {from.toLocaleDateString('ar-EG')} ← {to.toLocaleDateString('ar-EG')}
      </span>
    </div>
  );
}
