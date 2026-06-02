import { useEffect, useMemo, useState } from 'react';
import { Shield, Check, Minus, ArrowRightLeft, AlertTriangle, UserCheck, UserX } from 'lucide-react';
import { usersApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/Modal';

interface UserLite {
  id: number;
  name: string;
  role: string;
  isActive: boolean;
  _count?: { assignedClients: number };
}

// === Role meta ==============================================================
const ROLES: { key: string; labelAr: string; labelEn: string; bg: string; ring: string }[] = [
  { key: 'admin',            labelAr: 'مدير النظام',  labelEn: 'Admin',          bg: 'bg-slate-900 text-white',    ring: 'ring-slate-700' },
  { key: 'general_manager',  labelAr: 'مدير عام',     labelEn: 'GM',             bg: 'bg-purple-600 text-white',   ring: 'ring-purple-300' },
  { key: 'vice_gm',          labelAr: 'نائب',         labelEn: 'VGM',            bg: 'bg-indigo-600 text-white',   ring: 'ring-indigo-300' },
  { key: 'systems_info',     labelAr: 'نظم معلومات',  labelEn: 'IT',             bg: 'bg-zinc-700 text-white',     ring: 'ring-zinc-300' },
  { key: 'sales_director',   labelAr: 'مدير مبيعات',  labelEn: 'Sales Dir',      bg: 'bg-blue-600 text-white',     ring: 'ring-blue-300' },
  { key: 'assistant_sales',  labelAr: 'مساعد مدير',   labelEn: 'Asst Dir',       bg: 'bg-cyan-500 text-white',     ring: 'ring-cyan-200' },
  { key: 'sales_rep',        labelAr: 'مندوب',        labelEn: 'Rep',            bg: 'bg-emerald-500 text-white',  ring: 'ring-emerald-200' },
  { key: 'credit_manager',   labelAr: 'مدير ائتمان',  labelEn: 'Credit Mgr',     bg: 'bg-rose-500 text-white',     ring: 'ring-rose-200' },
  { key: 'credit_officer',   labelAr: 'موظف ائتمان',  labelEn: 'Credit Off',     bg: 'bg-pink-500 text-white',     ring: 'ring-pink-200' },
  { key: 'contract_officer', labelAr: 'مسؤول عقود',   labelEn: 'Contract Off',   bg: 'bg-amber-500 text-white',    ring: 'ring-amber-200' },
  { key: 'reservations',     labelAr: 'حجوزات',       labelEn: 'Reservations',   bg: 'bg-teal-500 text-white',     ring: 'ring-teal-200' },
];

type Scope = 'all' | 'team' | 'own' | true | false;
interface PermRow { ar: string; en: string; perms: Partial<Record<string, Scope>> }
interface PermSection { titleAr: string; titleEn: string; rows: PermRow[] }

const ALL_ADMIN: Partial<Record<string, Scope>> = {
  admin: 'all', general_manager: 'all', vice_gm: 'all', systems_info: 'all',
};

const SECTIONS: PermSection[] = [
  {
    titleAr: 'العملاء', titleEn: 'Clients',
    rows: [
      {
        ar: 'رؤية العملاء', en: 'View clients',
        perms: { ...ALL_ADMIN, contract_officer: 'all', reservations: 'all', credit_manager: 'all', credit_officer: 'all',
                 sales_director: 'team', assistant_sales: 'team', sales_rep: 'own' },
      },
      { ar: 'إضافة عميل جديد', en: 'Create client', perms: { ...ALL_ADMIN, sales_director: true, assistant_sales: true, sales_rep: true } },
      { ar: 'تعديل اسم الشركة + نوع العميل', en: 'Edit company name + type', perms: { ...ALL_ADMIN, sales_director: true, assistant_sales: true, sales_rep: true } },
      { ar: 'تعديل البراندات + الفندق + الميزانية', en: 'Edit brands / hotel / budgets', perms: { ...ALL_ADMIN } },
      { ar: 'نقل عميل لمندوب آخر', en: 'Reassign client to another rep', perms: { ...ALL_ADMIN } },
      { ar: 'أرشفة عميل', en: 'Archive client', perms: { ...ALL_ADMIN } },
    ],
  },
  {
    titleAr: 'الزيارات', titleEn: 'Visits',
    rows: [
      {
        ar: 'رؤية الزيارات', en: 'View visits',
        perms: { ...ALL_ADMIN, contract_officer: 'all', sales_director: 'team', assistant_sales: 'team', sales_rep: 'own' },
      },
      { ar: 'تسجيل زيارة', en: 'Log a visit', perms: { ...ALL_ADMIN, sales_director: true, assistant_sales: true, sales_rep: true } },
    ],
  },
  {
    titleAr: 'العقود', titleEn: 'Contracts',
    rows: [
      {
        ar: 'رؤية العقود', en: 'View contracts',
        perms: { ...ALL_ADMIN, contract_officer: 'all', reservations: 'all', credit_manager: 'all', credit_officer: 'all',
                 sales_director: 'team', assistant_sales: 'team', sales_rep: 'own' },
      },
      { ar: 'إنشاء عقد', en: 'Create contract', perms: { ...ALL_ADMIN, sales_director: true, assistant_sales: true, sales_rep: true } },
      { ar: 'اعتماد مدير المبيعات', en: 'Approve (sales director)', perms: { admin: true, general_manager: true, systems_info: true, sales_director: true } },
      { ar: 'اعتماد الائتمان', en: 'Approve (credit)', perms: { admin: true, general_manager: true, credit_manager: true } },
      { ar: 'اعتماد العقود', en: 'Approve (contracts officer)', perms: { admin: true, general_manager: true, contract_officer: true } },
      { ar: 'الاعتماد النهائي', en: 'Final approval', perms: { admin: true, general_manager: true, vice_gm: true } },
    ],
  },
  {
    titleAr: 'عروض الأسعار', titleEn: 'Quotes',
    rows: [
      {
        ar: 'رؤية العروض', en: 'View quotes',
        perms: { ...ALL_ADMIN, credit_manager: 'all', credit_officer: 'all', reservations: 'all',
                 sales_director: 'team', assistant_sales: 'team', sales_rep: 'own' },
      },
      { ar: 'إنشاء عرض سعر', en: 'Create quote', perms: { ...ALL_ADMIN, sales_director: true, assistant_sales: true, sales_rep: true } },
      { ar: 'اعتماد / رفض عرض سعر', en: 'Approve / reject quote', perms: { admin: true, general_manager: true, systems_info: true, vice_gm: true, sales_director: true } },
    ],
  },
  {
    titleAr: 'الدفعات والائتمان', titleEn: 'Payments & Credit',
    rows: [
      {
        ar: 'رؤية الدفعات', en: 'View payments',
        perms: { ...ALL_ADMIN, contract_officer: 'all', credit_manager: 'all', credit_officer: 'all',
                 sales_director: 'team', assistant_sales: 'team', sales_rep: 'own' },
      },
      { ar: 'تسجيل دفعة', en: 'Record payment', perms: { admin: true, credit_officer: true } },
      { ar: 'اعتماد دفعة', en: 'Approve payment', perms: { admin: true, credit_manager: true } },
    ],
  },
  {
    titleAr: 'الحجوزات', titleEn: 'Bookings',
    rows: [
      {
        ar: 'رؤية الحجوزات', en: 'View bookings',
        perms: { ...ALL_ADMIN, reservations: 'all', contract_officer: 'all',
                 sales_director: 'team', assistant_sales: 'team', sales_rep: 'own' },
      },
      { ar: 'إنشاء / تعديل حجز', en: 'Create / update booking', perms: { ...ALL_ADMIN, reservations: true } },
    ],
  },
  {
    titleAr: 'المستخدمين والإدارة', titleEn: 'Users & Admin',
    rows: [
      { ar: 'رؤية كل المستخدمين', en: 'View all users', perms: { ...ALL_ADMIN, sales_director: 'team', assistant_sales: 'team' } },
      { ar: 'إنشاء / تعديل / تعطيل مستخدم', en: 'Create / edit / deactivate user', perms: { admin: true } },
      { ar: 'ضبط نسبة العمولة', en: 'Set commission rate', perms: { admin: true } },
      { ar: 'نقل عملاء بين المناديب', en: 'Transfer clients between reps', perms: { ...ALL_ADMIN } },
      { ar: 'إدارة الفنادق', en: 'Manage hotels', perms: { ...ALL_ADMIN } },
      { ar: 'إدارة العروض التسويقية', en: 'Manage promotions', perms: { ...ALL_ADMIN } },
    ],
  },
  {
    titleAr: 'المهام والأهداف', titleEn: 'Tasks & Targets',
    rows: [
      { ar: 'إنشاء أهداف للفريق', en: 'Set team targets', perms: { ...ALL_ADMIN, sales_director: true } },
      { ar: 'إنشاء / حذف مهام', en: 'Create / delete tasks', perms: { ...ALL_ADMIN, sales_director: true } },
      { ar: 'بث رسالة للفريق', en: 'Broadcast to team', perms: { ...ALL_ADMIN, sales_director: true } },
    ],
  },
];

// === Helpers ================================================================
function scopeCell(s: Scope | undefined, isAr: boolean) {
  if (s === 'all' || s === true) {
    return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
  }
  if (s === 'team') {
    return <span className="inline-block px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">
      {isAr ? 'فريق' : 'team'}
    </span>;
  }
  if (s === 'own') {
    return <span className="inline-block px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-bold">
      {isAr ? 'ذاتي' : 'own'}
    </span>;
  }
  return <Minus className="w-3.5 h-3.5 text-zinc-300 mx-auto" />;
}

// === Page ===================================================================
export default function Permissions() {
  const { hasRole } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const isAdminLevel = hasRole('admin', 'general_manager', 'systems_info', 'vice_gm');
  const [tab, setTab] = useState<'matrix' | 'transfer'>('matrix');

  // --- Transfer state ---
  const [users, setUsers] = useState<UserLite[]>([]);
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [alsoDeactivate, setAlsoDeactivate] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminLevel) return;
    usersApi.getAll().then(r => setUsers(r.data as UserLite[])).catch(() => {});
  }, [isAdminLevel]);

  const fromUser = useMemo(() => users.find(u => String(u.id) === fromId) || null, [users, fromId]);
  const toUser   = useMemo(() => users.find(u => String(u.id) === toId)   || null, [users, toId]);
  const fromClientCount = fromUser?._count?.assignedClients ?? 0;

  const doTransfer = async () => {
    if (!fromUser || !toUser) return;
    setBusy(true); setResultMsg(null);
    try {
      const r = await usersApi.transferClients(fromUser.id, toUser.id, alsoDeactivate);
      const d = r.data as { transferredClients: number; deactivated: boolean };
      setResultMsg(isAr
        ? `تم نقل ${d.transferredClients} عميل من ${fromUser.name} إلى ${toUser.name}${d.deactivated ? ' وتم تعطيل المندوب القديم.' : '.'}`
        : `Transferred ${d.transferredClients} clients from ${fromUser.name} to ${toUser.name}${d.deactivated ? '. Old rep deactivated.' : '.'}`);
      // Refresh user list so the counts reflect the move
      const fresh = await usersApi.getAll();
      setUsers(fresh.data as UserLite[]);
      setFromId(''); setToId(''); setAlsoDeactivate(false);
      setConfirmOpen(false);
    } catch (err: any) {
      setResultMsg(err?.response?.data?.message || (isAr ? 'فشل النقل' : 'Transfer failed'));
    } finally { setBusy(false); }
  };

  if (!isAdminLevel) {
    return (
      <div className={`p-6 ${isAr ? 'text-right' : ''}`}>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {isAr ? 'هذه الصفحة متاحة لمستخدمي الإدارة فقط.' : 'This page is restricted to admin-level users.'}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${isAr ? 'text-right' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-900 text-white flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-900">{isAr ? 'الصلاحيات' : 'Permissions'}</h1>
          <p className="text-xs text-brand-400">
            {isAr ? 'إدارة صلاحيات الأدوار ونقل العملاء بين المناديب' : 'Role permissions and client handover'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 border-b border-brand-100 ${isAr ? 'flex-row-reverse' : ''}`}>
        {[
          { k: 'matrix' as const,   ar: 'مصفوفة الصلاحيات', en: 'Permissions Matrix' },
          { k: 'transfer' as const, ar: 'نقل عملاء',         en: 'Transfer Clients' },
        ].map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors
              ${tab === tb.k ? 'border-brand-900 text-brand-900' : 'border-transparent text-brand-400 hover:text-brand-700'}`}>
            {isAr ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {/* ===== Matrix tab ===== */}
      {tab === 'matrix' && (
        <div className="space-y-4">
          {/* Legend */}
          <div className={`flex items-center gap-3 flex-wrap text-xs text-brand-500 ${isAr ? 'flex-row-reverse' : ''}`}>
            <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /> {isAr ? 'مسموح' : 'allowed'}</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">{isAr ? 'فريق' : 'team'}</span> {isAr ? 'يشوف الفريق فقط' : 'team scope'}</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-bold">{isAr ? 'ذاتي' : 'own'}</span> {isAr ? 'يشوف بياناته فقط' : 'own only'}</span>
            <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-zinc-300" /> {isAr ? 'غير مسموح' : 'denied'}</span>
          </div>

          {/* Matrix tables */}
          {SECTIONS.map(section => (
            <div key={section.titleEn} className="rounded-xl border border-brand-100 bg-white overflow-hidden">
              <div className="px-4 py-2 bg-brand-50 border-b border-brand-100">
                <h2 className="text-sm font-bold text-brand-900">{isAr ? section.titleAr : section.titleEn}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white">
                      <th className={`sticky ${isAr ? 'right-0' : 'left-0'} bg-white px-3 py-2 text-[11px] font-bold text-brand-500 ${isAr ? 'text-right' : 'text-left'} min-w-[220px] border-b border-brand-100`}>
                        {isAr ? 'الصلاحية' : 'Capability'}
                      </th>
                      {ROLES.map(r => (
                        <th key={r.key} className="px-2 py-2 text-center border-b border-brand-100">
                          <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold ${r.bg}`}>
                            {isAr ? r.labelAr : r.labelEn}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-brand-50/30">
                        <td className={`sticky ${isAr ? 'right-0' : 'left-0'} bg-white px-3 py-2 ${isAr ? 'text-right' : 'text-left'} text-brand-700 border-b border-brand-50`}>
                          {isAr ? row.ar : row.en}
                        </td>
                        {ROLES.map(r => (
                          <td key={r.key} className="px-2 py-2 text-center border-b border-brand-50">
                            {scopeCell(row.perms[r.key], isAr)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className={`text-[11px] text-brand-400 ${isAr ? 'text-right' : ''}`}>
            {isAr
              ? 'ملاحظة: مصفوفة الصلاحيات هذه مرجعية — تعديل الصلاحيات يتم في الكود. لتغيير دور موظف معيّن، استخدم صفحة "المستخدمون".'
              : 'Note: this matrix is reference-only — permissions are code-defined. To change an employee\'s role, use the Users page.'}
          </div>
        </div>
      )}

      {/* ===== Transfer tab ===== */}
      {tab === 'transfer' && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              {isAr
                ? 'نقل العملاء بيغيّر المندوب المسؤول على كل العملاء النشطين للمندوب القديم. الزيارات والعقود والدفعات القديمة بتفضل مسجلة باسم المندوب الأصلي (للحفاظ على سجل التاريخ).'
                : 'Transfer reassigns every active client from the source rep to the new rep. Past visits, contracts, and payments keep their original owner so the audit trail stays intact.'}
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-white p-5 space-y-4">
            {/* From */}
            <div>
              <label className="label">{isAr ? 'المندوب الحالي (المنقول منه)' : 'Source rep (transfer FROM)'}</label>
              <select className="input" value={fromId} onChange={e => setFromId(e.target.value)}>
                <option value="">{isAr ? '— اختر —' : '— select —'}</option>
                {users
                  .filter(u => ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role))
                  .sort((a, b) => (b._count?.assignedClients ?? 0) - (a._count?.assignedClients ?? 0))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u._count?.assignedClients ?? 0} {isAr ? 'عميل' : 'clients'}
                      {!u.isActive ? (isAr ? ' (معطّل)' : ' (inactive)') : ''}
                    </option>
                  ))}
              </select>
              {fromUser && (
                <div className="mt-2 text-xs text-brand-500">
                  <UserX className="w-3.5 h-3.5 inline mb-0.5" /> {isAr ? 'سيتم نقل ' : 'Will transfer '}
                  <span className="font-bold text-brand-900">{fromClientCount}</span> {isAr ? 'عميل نشط.' : 'active clients.'}
                </div>
              )}
            </div>

            {/* To */}
            <div>
              <label className="label">{isAr ? 'المندوب الجديد (المنقول إليه)' : 'Destination rep (transfer TO)'}</label>
              <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
                <option value="">{isAr ? '— اختر —' : '— select —'}</option>
                {users
                  .filter(u => u.isActive && ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role) && String(u.id) !== fromId)
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
              {toUser && (
                <div className="mt-2 text-xs text-brand-500">
                  <UserCheck className="w-3.5 h-3.5 inline mb-0.5" /> {isAr ? 'العميل سيظهر في صفحة ' : 'Clients will appear under '}
                  <span className="font-bold text-brand-900">{toUser.name}</span>.
                </div>
              )}
            </div>

            {/* Deactivate option */}
            <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border ${alsoDeactivate ? 'bg-rose-50 border-rose-200' : 'bg-zinc-50 border-zinc-200'}`}>
              <input type="checkbox" checked={alsoDeactivate} onChange={e => setAlsoDeactivate(e.target.checked)} />
              <span className="text-sm text-brand-700">
                {isAr ? 'تعطيل المندوب القديم بعد النقل (لن يتمكن من تسجيل الدخول)' : 'Deactivate the source rep after transfer (they can no longer sign in)'}
              </span>
            </label>

            {/* Action */}
            <div className={`flex gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
              <button className="btn-primary inline-flex items-center gap-2"
                disabled={!fromUser || !toUser || fromClientCount === 0 && !alsoDeactivate}
                onClick={() => setConfirmOpen(true)}>
                <ArrowRightLeft className="w-4 h-4" />
                {isAr ? 'تنفيذ النقل' : 'Transfer now'}
              </button>
              {resultMsg && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex-1">
                  {resultMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <Modal open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)}
        title={isAr ? 'تأكيد نقل العملاء' : 'Confirm client transfer'} size="md">
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            {isAr
              ? <>سيتم نقل <strong>{fromClientCount}</strong> عميل نشط من <strong>{fromUser?.name}</strong> إلى <strong>{toUser?.name}</strong>.</>
              : <>You will transfer <strong>{fromClientCount}</strong> active clients from <strong>{fromUser?.name}</strong> to <strong>{toUser?.name}</strong>.</>}
            {alsoDeactivate && <div className="mt-2 text-rose-700 font-semibold">
              {isAr ? 'وسيتم تعطيل المندوب القديم.' : 'The source rep will also be deactivated.'}
            </div>}
          </div>
          <div className={`flex gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
            <button className="btn-primary" disabled={busy} onClick={doTransfer}>
              {busy ? (isAr ? 'جاري النقل…' : 'Transferring…') : (isAr ? 'تأكيد النقل' : 'Confirm transfer')}
            </button>
            <button className="btn-secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
