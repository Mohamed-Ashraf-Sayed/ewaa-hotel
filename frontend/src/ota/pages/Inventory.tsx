import { useEffect, useState } from 'react';
import { BedDouble, Building2, Hotel, Loader2, Pencil, Save, X } from 'lucide-react';
import { fetchInventory, updateInventory, InventoryItem, InventoryByBrand, BRAND_AR } from '../api';

const BRAND_ICONS: Record<string, any> = {
  muhaidib_serviced: Building2,
  awa_hotels:        Hotel,
  grand_plaza:       BedDouble,
};
const BRAND_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  muhaidib_serviced: { bg: 'from-amber-500 to-amber-600', text: 'text-amber-700', ring: 'ring-amber-200' },
  awa_hotels:        { bg: 'from-emerald-500 to-emerald-600', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  grand_plaza:       { bg: 'from-violet-500 to-violet-600', text: 'text-violet-700', ring: 'ring-violet-200' },
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [byBrand, setByBrand] = useState<InventoryByBrand[]>([]);
  const [totals, setTotals] = useState({ branches: 0, rooms: 0 });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const load = () => {
    setLoading(true);
    fetchInventory().then(d => {
      setItems(d.items);
      setByBrand(d.byBrand);
      setTotals({ branches: d.totalBranches, rooms: d.totalRooms });
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (it: InventoryItem) => {
    setEditingId(it.id);
    setEditValue(String(it.rooms));
  };
  const cancelEdit = () => { setEditingId(null); setEditValue(''); };
  const saveEdit = async (it: InventoryItem) => {
    const n = parseInt(editValue, 10);
    if (isNaN(n) || n < 0) { cancelEdit(); return; }
    setSaving(true);
    try {
      await updateInventory(it.id, { rooms: n });
      setItems(items.map(x => x.id === it.id ? { ...x, rooms: n } : x));
      // Recompute brand totals client-side so the user sees the change immediately
      // without waiting for a full re-fetch.
      setByBrand(byBrand.map(b => b.brand === it.brand
        ? { ...b, rooms: b.rooms - it.rooms + n }
        : b));
      setTotals(t => ({ ...t, rooms: t.rooms - it.rooms + n }));
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const visible = brandFilter === 'all' ? items : items.filter(i => i.brand === brandFilter);

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-slate-500">
      <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
    </div>
  );

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <BedDouble className="w-6 h-6" /> مخزون الغرف لكل فرع
        </h1>
        <p className="text-sm text-slate-500 mt-1">إجمالي السعة (عدد الغرف) لكل فندق — يُستخدم لحساب نسبة حجوزات OTA لكل فرع</p>
      </div>

      {/* Brand summary cards — gradient stripe + total rooms + branch count.
          Tap any to filter the table below to that brand only. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <BrandCard
          label="الإجمالي"
          rooms={totals.rooms}
          branches={totals.branches}
          gradient="from-brand-500 to-brand-600"
          Icon={BedDouble}
          active={brandFilter === 'all'}
          onClick={() => setBrandFilter('all')}
        />
        {byBrand.map(b => {
          const Icon = BRAND_ICONS[b.brand] || Building2;
          const colors = BRAND_COLORS[b.brand];
          return (
            <BrandCard
              key={b.brand}
              label={BRAND_AR[b.brand] || b.brand}
              rooms={b.rooms}
              branches={b.branches}
              gradient={colors?.bg || 'from-slate-500 to-slate-600'}
              Icon={Icon}
              active={brandFilter === b.brand}
              onClick={() => setBrandFilter(b.brand)}
            />
          );
        })}
      </div>

      {/* Inventory table — name + rooms with inline edit. Brand badge shows
          which group the branch belongs to. */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">
            الفنادق ({visible.length}{brandFilter !== 'all' ? ` من ${items.length}` : ''})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-right p-3 font-semibold w-12">#</th>
                <th className="text-right p-3 font-semibold">اسم الفندق</th>
                <th className="text-right p-3 font-semibold w-44">المجموعة</th>
                <th className="text-right p-3 font-semibold w-32">عدد الغرف</th>
                <th className="text-right p-3 font-semibold w-24">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it, i) => {
                const colors = BRAND_COLORS[it.brand];
                const isEditing = editingId === it.id;
                return (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="p-3 font-medium text-slate-900">{it.name}</td>
                    <td className="p-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${colors?.text || 'text-slate-600'} bg-white`}
                        style={{ borderColor: 'currentColor', opacity: 0.85 }}>
                        {BRAND_AR[it.brand] || it.brand}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums font-bold">
                      {isEditing ? (
                        <input type="number" min="0" value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                          className="w-20 border border-blue-400 rounded px-2 py-1 text-sm tabular-nums" />
                      ) : (
                        it.rooms
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(it)} disabled={saving}
                            className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 rounded bg-slate-50 text-slate-600 hover:bg-slate-100">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(it)}
                          className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BrandCard({ label, rooms, branches, gradient, Icon, active, onClick }: {
  label: string; rooms: number; branches: number;
  gradient: string; Icon: any; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`relative bg-white rounded-lg border p-4 overflow-hidden text-right transition ${
        active ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300'
      }`}>
      <div className={`absolute inset-y-0 right-0 w-1 bg-gradient-to-b ${gradient}`} />
      <div className="flex items-center justify-between gap-2 flex-row-reverse">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} text-white shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-900 tracking-tight leading-none tabular-nums">{rooms.toLocaleString('ar-EG')}</p>
          <p className="text-xs text-slate-500 mt-1.5">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{branches} فرع</p>
        </div>
      </div>
    </button>
  );
}
