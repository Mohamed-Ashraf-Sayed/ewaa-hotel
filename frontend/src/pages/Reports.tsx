import { useEffect, useState } from 'react';
import { Download, Building2, FileText, TrendingUp, Users, MapPin, Target as TargetIcon, FileSpreadsheet, Filter, CreditCard } from 'lucide-react';
import { pdfApi, contractsApi, clientsApi, visitsApi, paymentsApi, usersApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/Modal';
import { format, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

type FilterKey = 'type' | 'dateRange' | 'rep' | 'status' | 'visitType' | 'paymentMethod';

interface ReportCard {
  key: string;
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  icon: any;
  color: string;
  iconColor: string;
  filters?: FilterKey[];
  hasPdf?: boolean;
}

const REPORTS: ReportCard[] = [
  {
    key: 'clients',
    title: { ar: 'تقرير العملاء', en: 'Clients Report' },
    description: { ar: 'قائمة كاملة بكل العملاء وبياناتهم', en: 'Full list of all clients with their data' },
    icon: Building2,
    color: 'bg-sky-50',
    iconColor: 'text-sky-600',
    filters: ['type', 'rep', 'dateRange'],
    hasPdf: true,
  },
  {
    key: 'contracts',
    title: { ar: 'تقرير العقود', en: 'Contracts Report' },
    description: { ar: 'كل العقود مع حالتها وقيمتها', en: 'All contracts with status and value' },
    icon: FileText,
    color: 'bg-brand-50',
    iconColor: 'text-brand-600',
    filters: ['status', 'rep', 'dateRange'],
    hasPdf: true,
  },
  {
    key: 'visits',
    title: { ar: 'تقرير الزيارات', en: 'Visits Report' },
    description: { ar: 'كل زيارات المناديب للعملاء', en: 'All sales rep visits to clients' },
    icon: MapPin,
    color: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    filters: ['rep', 'visitType', 'dateRange'],
    hasPdf: true,
  },
  {
    key: 'payments',
    title: { ar: 'تقرير التحصيل', en: 'Collections Report' },
    description: { ar: 'كل المبالغ المحصلة من العملاء مع فلتر طريقة السداد', en: 'All collected amounts with payment method filter' },
    icon: TrendingUp,
    color: 'bg-amber-50',
    iconColor: 'text-amber-600',
    filters: ['rep', 'paymentMethod', 'dateRange'],
    hasPdf: true,
  },
  {
    key: 'paymentMethods',
    title: { ar: 'طرق سداد العملاء للعقد', en: 'Client Payment Methods per Contract' },
    description: { ar: 'بيان طرق السداد (كاش / تحويل بنكي / شيك) لكل عقد', en: 'Payment method breakdown (cash / bank / cheque) per contract' },
    icon: CreditCard,
    color: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    filters: ['rep', 'dateRange'],
    hasPdf: true,
  },
  {
    key: 'team',
    title: { ar: 'أداء فريق المبيعات', en: 'Sales Team Performance' },
    description: { ar: 'تقرير شامل عن أداء كل مندوب', en: 'Comprehensive report on each rep performance' },
    icon: Users,
    color: 'bg-violet-50',
    iconColor: 'text-violet-600',
    hasPdf: true,
  },
  {
    key: 'targets',
    title: { ar: 'تقرير التارجت والإنجاز', en: 'Targets & Achievement' },
    description: { ar: 'مقارنة التارجت مع الإنجاز الفعلي', en: 'Compare targets with actual achievements' },
    icon: TargetIcon,
    color: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
];

// === Arabic label maps ===
const CLIENT_TYPE_AR: Record<string, string> = { active: 'نشط', lead: 'محتمل', inactive: 'غير نشط' };
const CONTRACT_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  sales_approved: 'بانتظار الائتمان',
  credit_approved: 'بانتظار العقود',
  contract_approved: 'بانتظار نائب المدير',
  approved: 'معتمد نهائي',
  rejected: 'مرفوض',
};
const VISIT_TYPE_AR: Record<string, string> = {
  in_person: 'زيارة شخصية',
  phone: 'هاتف',
  online: 'أونلاين',
  site_visit: 'زيارة الموقع',
};
const ROLE_AR: Record<string, string> = {
  admin: 'مسؤول النظام',
  general_manager: 'المدير العام',
  vice_gm: 'نائب المدير العام',
  sales_director: 'مدير المبيعات',
  assistant_sales: 'مساعد مدير المبيعات',
  sales_rep: 'مندوب مبيعات',
  contract_officer: 'مسئول العقود',
  reservations: 'الحجوزات',
  credit_manager: 'مدير الائتمان',
  credit_officer: 'موظف الائتمان',
};
const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  cheque: 'شيك',
  card: 'بطاقة',
};
const SOURCE_AR: Record<string, string> = {
  cold_call: 'اتصال بارد', referral: 'إحالة', exhibition: 'معرض',
  website: 'الموقع الإلكتروني', social_media: 'وسائل التواصل', walk_in: 'زيارة مباشرة', other: 'أخرى',
};

export default function Reports() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [generating, setGenerating] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [reps, setReps] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    usersApi.getAll().then(r => {
      setReps((r.data as any[])
        .filter(u => u.isActive && ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role))
        .map(u => ({ id: u.id, name: u.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')));
    }).catch(() => setReps([]));
  }, []);

  const downloadFile = (data: BlobPart, filename: string, mimeType = 'application/pdf') => {
    const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // === Value translators ===
  const fmtDate = (v: any) => {
    if (!v) return '';
    try { return format(parseISO(String(v)), 'dd/MM/yyyy', { locale }); } catch { return String(v); }
  };
  const fmtNum = (v: any) => v == null || v === '' ? '' : Number(v).toLocaleString(isAr ? 'ar-EG' : 'en');

  const exportToCSV = (
    data: any[],
    filename: string,
    headers: { key: string; label: string; transform?: (v: any, row: any) => any }[],
  ) => {
    const BOM = '\uFEFF';
    const headerRow = headers.map(h => `"${h.label}"`).join(',');
    const dataRows = data.map(row =>
      headers.map(h => {
        const raw = h.key.split('.').reduce((acc, k) => acc?.[k], row);
        const val = h.transform ? h.transform(raw, row) : raw;
        return `"${(val ?? '').toString().replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = BOM + [headerRow, ...dataRows].join('\n');
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  };

  // Filter helpers — apply client-side date range + rep filters on already-fetched arrays
  const applyDateRange = <T,>(data: T[], dateField: string, from?: string, to?: string): T[] => {
    if (!from && !to) return data;
    return data.filter((row: any) => {
      const raw = dateField.split('.').reduce((acc, k) => acc?.[k], row);
      if (!raw) return false;
      const d = new Date(raw);
      if (from && d < new Date(from)) return false;
      if (to && d > new Date(to + 'T23:59:59')) return false;
      return true;
    });
  };

  const generate = async (key: string, format: 'pdf' | 'csv' = 'pdf') => {
    setGenerating(`${key}-${format}`);
    const f = filters[key] || {};
    try {
      switch (key) {
        case 'clients':
          if (format === 'pdf') {
            const res = await pdfApi.clientReport({
              type: f.type || undefined,
              salesRepId: f.salesRepId || undefined,
              from: f.from || undefined,
              to: f.to || undefined,
            });
            downloadFile(res.data, 'Clients_Report.pdf');
          } else {
            let { data } = await clientsApi.getAll({ type: f.type || undefined });
            if (f.salesRepId) data = data.filter((c: any) => c.salesRep?.id === parseInt(f.salesRepId));
            data = applyDateRange(data, 'createdAt', f.from, f.to);
            exportToCSV(data, 'Clients.csv', [
              { key: 'companyName', label: isAr ? 'الشركة' : 'Company' },
              { key: 'contactPerson', label: isAr ? 'جهة الاتصال' : 'Contact' },
              { key: 'phone', label: isAr ? 'الهاتف' : 'Phone' },
              { key: 'email', label: isAr ? 'البريد' : 'Email' },
              { key: 'industry', label: isAr ? 'القطاع' : 'Industry' },
              { key: 'clientType', label: isAr ? 'النوع' : 'Type', transform: v => isAr ? (CLIENT_TYPE_AR[v] || v) : v },
              { key: 'source', label: isAr ? 'المصدر' : 'Source', transform: v => isAr ? (SOURCE_AR[v] || v) : v },
              { key: 'hotel.name', label: isAr ? 'الفندق' : 'Hotel' },
              { key: 'salesRep.name', label: isAr ? 'المندوب' : 'Sales Rep' },
              { key: 'createdAt', label: isAr ? 'تاريخ الإضافة' : 'Added On', transform: fmtDate },
            ]);
          }
          break;
        case 'contracts': {
          if (format === 'pdf') {
            const res = await pdfApi.contractsReport({
              status: f.status || undefined,
              salesRepId: f.salesRepId || undefined,
              from: f.from || undefined,
              to: f.to || undefined,
            });
            downloadFile(res.data, 'Contracts_Report.pdf');
            break;
          }
          let { data } = await contractsApi.getAll({
            status: f.status || undefined,
            salesRepId: f.salesRepId ? parseInt(f.salesRepId) : undefined,
          });
          data = applyDateRange(data, 'createdAt', f.from, f.to);
          exportToCSV(data, 'Contracts.csv', [
            { key: 'contractRef', label: isAr ? 'رقم العقد' : 'Ref' },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'hotel.name', label: isAr ? 'الفندق' : 'Hotel' },
            { key: 'salesRep.name', label: isAr ? 'المندوب' : 'Rep' },
            { key: 'roomsCount', label: isAr ? 'الغرف' : 'Rooms' },
            { key: 'ratePerRoom', label: isAr ? 'السعر/غرفة' : 'Rate', transform: fmtNum },
            { key: 'totalValue', label: isAr ? 'القيمة' : 'Value', transform: fmtNum },
            { key: 'collectedAmount', label: isAr ? 'المحصل' : 'Collected', transform: fmtNum },
            { key: 'status', label: isAr ? 'الحالة' : 'Status', transform: v => isAr ? (CONTRACT_STATUS_AR[v] || v) : v },
            { key: 'startDate', label: isAr ? 'البداية' : 'Start', transform: fmtDate },
            { key: 'endDate', label: isAr ? 'النهاية' : 'End', transform: fmtDate },
            { key: 'createdAt', label: isAr ? 'تاريخ الرفع' : 'Created', transform: fmtDate },
          ]);
          break;
        }
        case 'visits': {
          if (format === 'pdf') {
            const res = await pdfApi.visitsReport({
              salesRepId: f.salesRepId || undefined,
              visitType: f.visitType || undefined,
              from: f.from || undefined,
              to: f.to || undefined,
            });
            downloadFile(res.data, 'Visits_Report.pdf');
            break;
          }
          let { data } = await visitsApi.getAll({ salesRepId: f.salesRepId ? parseInt(f.salesRepId) : undefined });
          if (f.visitType) data = data.filter((v: any) => v.visitType === f.visitType);
          data = applyDateRange(data, 'visitDate', f.from, f.to);
          exportToCSV(data, 'Visits.csv', [
            { key: 'visitDate', label: isAr ? 'التاريخ' : 'Date', transform: fmtDate },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'client.contactPerson', label: isAr ? 'جهة الاتصال' : 'Contact' },
            { key: 'salesRep.name', label: isAr ? 'المندوب' : 'Rep' },
            { key: 'visitType', label: isAr ? 'النوع' : 'Type', transform: v => isAr ? (VISIT_TYPE_AR[v] || v) : v },
            { key: 'purpose', label: isAr ? 'الغرض' : 'Purpose' },
            { key: 'outcome', label: isAr ? 'النتيجة' : 'Outcome' },
            { key: 'nextFollowUp', label: isAr ? 'المتابعة' : 'Follow-up', transform: fmtDate },
          ]);
          break;
        }
        case 'payments': {
          if (format === 'pdf') {
            const res = await pdfApi.paymentsReport({
              salesRepId: f.salesRepId || undefined,
              paymentType: f.paymentMethod || undefined,
              from: f.from || undefined,
              to: f.to || undefined,
            });
            downloadFile(res.data, 'Payments_Report.pdf');
            break;
          }
          let { data } = await paymentsApi.getAll();
          if (f.salesRepId) data = data.filter((p: any) => p.collector?.id === parseInt(f.salesRepId));
          if (f.paymentMethod) data = data.filter((p: any) => p.paymentType === f.paymentMethod);
          data = applyDateRange(data, 'paymentDate', f.from, f.to);
          exportToCSV(data, 'Payments.csv', [
            { key: 'paymentDate', label: isAr ? 'التاريخ' : 'Date', transform: fmtDate },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'contract.contractRef', label: isAr ? 'العقد' : 'Contract' },
            { key: 'amount', label: isAr ? 'المبلغ' : 'Amount', transform: fmtNum },
            { key: 'paymentType', label: isAr ? 'الطريقة' : 'Method', transform: v => isAr ? (PAYMENT_METHOD_AR[v] || v) : v },
            { key: 'reference', label: isAr ? 'المرجع' : 'Reference' },
            { key: 'collector.name', label: isAr ? 'المُحصِّل' : 'Collected By' },
          ]);
          break;
        }
        case 'paymentMethods': {
          if (format === 'pdf') {
            const res = await pdfApi.paymentMethodsReport({
              salesRepId: f.salesRepId || undefined,
              from: f.from || undefined,
              to: f.to || undefined,
            });
            downloadFile(res.data, 'Payment_Methods.pdf');
            break;
          }
          let { data: payments } = await paymentsApi.getAll();
          if (f.salesRepId) payments = payments.filter((p: any) => p.collector?.id === parseInt(f.salesRepId));
          payments = applyDateRange(payments, 'paymentDate', f.from, f.to);

          // Group by contract, aggregate per method
          const byContract: Record<string, any> = {};
          for (const p of payments) {
            const cid = p.contract?.id || p.contractId;
            if (!cid) continue;
            if (!byContract[cid]) {
              byContract[cid] = {
                contractRef: p.contract?.contractRef || `#${cid}`,
                companyName: p.client?.companyName || '',
                totalCollected: 0,
                cash: 0, bank_transfer: 0, cheque: 0, card: 0, online: 0, check: 0,
                count: 0,
              };
            }
            byContract[cid].totalCollected += Number(p.amount || 0);
            byContract[cid].count += 1;
            const key = p.paymentType || 'other';
            byContract[cid][key] = (byContract[cid][key] || 0) + Number(p.amount || 0);
          }
          const rows = Object.values(byContract);
          if (rows.length === 0) {
            alert(isAr ? 'لا توجد مدفوعات مطابقة للفلاتر' : 'No payments match filters');
            break;
          }
          exportToCSV(rows, 'Payment_Methods_By_Contract.csv', [
            { key: 'contractRef', label: isAr ? 'العقد' : 'Contract' },
            { key: 'companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'count', label: isAr ? 'عدد الدفعات' : 'Payments #' },
            { key: 'cash', label: isAr ? 'نقدي' : 'Cash', transform: fmtNum },
            { key: 'bank_transfer', label: isAr ? 'تحويل بنكي' : 'Bank Transfer', transform: fmtNum },
            { key: 'cheque', label: isAr ? 'شيك' : 'Cheque', transform: fmtNum },
            { key: 'card', label: isAr ? 'بطاقة' : 'Card', transform: fmtNum },
            { key: 'totalCollected', label: isAr ? 'إجمالي المحصل' : 'Total Collected', transform: fmtNum },
          ]);
          break;
        }
        case 'team': {
          if (format === 'pdf') {
            const res = await pdfApi.teamReport();
            downloadFile(res.data, 'Team_Performance.pdf');
            break;
          }
          const res = await usersApi.getAll();
          const data = res.data.filter((u: any) => ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role));
          exportToCSV(data, 'Team.csv', [
            { key: 'name', label: isAr ? 'الاسم' : 'Name' },
            { key: 'email', label: isAr ? 'البريد' : 'Email' },
            { key: 'phone', label: isAr ? 'الهاتف' : 'Phone' },
            { key: 'role', label: isAr ? 'الدور' : 'Role', transform: v => isAr ? (ROLE_AR[v] || v) : v },
            { key: 'commissionRate', label: isAr ? 'العمولة %' : 'Commission %' },
            { key: '_count.assignedClients', label: isAr ? 'العملاء' : 'Clients' },
            { key: '_count.contracts', label: isAr ? 'العقود' : 'Contracts' },
          ]);
          break;
        }
        case 'targets': {
          alert(isAr ? 'هذا التقرير قيد التطوير - استخدم صفحة التارجت' : 'This report is under development - use the Targets page');
          break;
        }
      }
      setOpenModal(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'فشل إنشاء التقرير' : 'Failed to generate report'));
    } finally {
      setGenerating(null);
    }
  };

  const current = REPORTS.find(r => r.key === openModal);
  const f = current ? (filters[current.key] || {}) : {};
  const setF = (patch: any) => {
    if (!current) return;
    setFilters(p => ({ ...p, [current.key]: { ...p[current.key], ...patch } }));
  };

  return (
    <div className="space-y-5">
      <div className={isAr ? 'text-right' : 'text-left'}>
        <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'التقارير' : 'Reports'}</h1>
        <p className="text-brand-400 text-sm mt-0.5">
          {isAr ? 'اضغط على أي تقرير لتحديد الفلاتر وتنزيله' : 'Click any report to pick filters and download'}
        </p>
      </div>

      {/* Reports Grid — simpler cards, click opens modal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(r => {
          const activeFilters = filters[r.key] ? Object.values(filters[r.key]).filter(v => v).length : 0;
          return (
            <button key={r.key}
              onClick={() => setOpenModal(r.key)}
              className="card p-5 text-start hover:shadow-md hover:border-brand-300 transition-all">
              <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.color} flex-shrink-0`}>
                  <r.icon className={`w-6 h-6 ${r.iconColor}`} />
                </div>
                {activeFilters > 0 && (
                  <span className="inline-flex items-center gap-1 bg-brand-100 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Filter className="w-3 h-3" /> {activeFilters}
                  </span>
                )}
              </div>
              <div className={`mt-4 ${isAr ? 'text-right' : 'text-left'}`}>
                <h3 className="font-bold text-brand-900">{isAr ? r.title.ar : r.title.en}</h3>
                <p className="text-xs text-brand-400 mt-1 leading-relaxed">{isAr ? r.description.ar : r.description.en}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="card p-4 bg-brand-50/30 border-brand-200">
        <p className={`text-xs text-brand-600 ${isAr ? 'text-right' : 'text-left'}`}>
          💡 {isAr
            ? 'ملفات Excel/CSV يمكن فتحها في Microsoft Excel أو Google Sheets. ملفات PDF جاهزة للطباعة والمشاركة.'
            : 'Excel/CSV files can be opened in Microsoft Excel or Google Sheets. PDF files are ready to print and share.'}
        </p>
      </div>

      {/* Filter Modal */}
      <Modal open={!!current} onClose={() => setOpenModal(null)}
        title={current ? (isAr ? current.title.ar : current.title.en) : ''}>
        {current && (
          <div className="space-y-4">
            <p className={`text-xs text-brand-500 ${isAr ? 'text-right' : 'text-left'}`}>
              {isAr ? current.description.ar : current.description.en}
            </p>

            {(!current.filters || current.filters.length === 0) && (
              <p className={`text-xs text-brand-400 ${isAr ? 'text-right' : 'text-left'}`}>
                {isAr ? 'هذا التقرير بدون فلاتر' : 'No filters for this report'}
              </p>
            )}

            {current.filters?.includes('type') && (
              <div>
                <label className="label">{isAr ? 'نوع العميل' : 'Client Type'}</label>
                <select className="input" value={f.type || ''} onChange={e => setF({ type: e.target.value })}>
                  <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
                  <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                  <option value="lead">{isAr ? 'محتمل' : 'Lead'}</option>
                  <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
                </select>
              </div>
            )}

            {current.filters?.includes('status') && (
              <div>
                <label className="label">{isAr ? 'حالة العقد' : 'Contract Status'}</label>
                <select className="input" value={f.status || ''} onChange={e => setF({ status: e.target.value })}>
                  <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
                  {Object.entries(CONTRACT_STATUS_AR).map(([k, v]) => (
                    <option key={k} value={k}>{isAr ? v : k}</option>
                  ))}
                </select>
              </div>
            )}

            {current.filters?.includes('visitType') && (
              <div>
                <label className="label">{isAr ? 'نوع الزيارة' : 'Visit Type'}</label>
                <select className="input" value={f.visitType || ''} onChange={e => setF({ visitType: e.target.value })}>
                  <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
                  {Object.entries(VISIT_TYPE_AR).map(([k, v]) => (
                    <option key={k} value={k}>{isAr ? v : k}</option>
                  ))}
                </select>
              </div>
            )}

            {current.filters?.includes('paymentMethod') && (
              <div>
                <label className="label">{isAr ? 'طريقة السداد' : 'Payment Method'}</label>
                <select className="input" value={f.paymentMethod || ''} onChange={e => setF({ paymentMethod: e.target.value })}>
                  <option value="">{isAr ? 'كل الطرق' : 'All methods'}</option>
                  <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                  <option value="bank_transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                  <option value="cheque">{isAr ? 'شيك' : 'Cheque'}</option>
                  <option value="card">{isAr ? 'بطاقة' : 'Card'}</option>
                </select>
              </div>
            )}

            {current.filters?.includes('rep') && reps.length > 0 && (
              <div>
                <label className="label">{isAr ? 'المندوب' : 'Sales Rep'}</label>
                <select className="input" value={f.salesRepId || ''} onChange={e => setF({ salesRepId: e.target.value })}>
                  <option value="">{isAr ? 'كل المناديب' : 'All reps'}</option>
                  {reps.map(rep => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                </select>
              </div>
            )}

            {current.filters?.includes('dateRange') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{isAr ? 'من تاريخ' : 'From'}</label>
                  <input type="date" className="input" value={f.from || ''} onChange={e => setF({ from: e.target.value })} />
                </div>
                <div>
                  <label className="label">{isAr ? 'إلى تاريخ' : 'To'}</label>
                  <input type="date" className="input" value={f.to || ''} onChange={e => setF({ to: e.target.value })} />
                </div>
              </div>
            )}

            {Object.values(f).some(v => v) && (
              <button onClick={() => setFilters(p => ({ ...p, [current.key]: {} }))}
                className="text-xs text-brand-500 hover:text-brand-700 underline">
                {isAr ? '✕ مسح الفلاتر' : '✕ Clear filters'}
              </button>
            )}

            <div className={`flex gap-2 pt-2 border-t border-brand-100 ${isAr ? 'flex-row-reverse' : ''}`}>
              {current.hasPdf && (
                <button onClick={() => generate(current.key, 'pdf')} disabled={generating === `${current.key}-pdf`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {generating === `${current.key}-pdf` ? (isAr ? 'جاري الإنشاء...' : 'Generating...') : <><Download className="w-4 h-4" /> PDF</>}
                </button>
              )}
              <button onClick={() => generate(current.key, 'csv')} disabled={generating === `${current.key}-csv`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {generating === `${current.key}-csv` ? (isAr ? 'جاري الإنشاء...' : 'Generating...') : <><FileSpreadsheet className="w-4 h-4" /> Excel/CSV</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
