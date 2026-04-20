import { useState } from 'react';
import { Download, Building2, FileText, TrendingUp, Users, MapPin, Target as TargetIcon, FileSpreadsheet } from 'lucide-react';
import { pdfApi, contractsApi, clientsApi, visitsApi, paymentsApi, usersApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

interface ReportCard {
  key: string;
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  icon: any;
  color: string;
  iconColor: string;
  filters?: ('type' | 'dateRange' | 'rep')[];
}

const REPORTS: ReportCard[] = [
  {
    key: 'clients',
    title: { ar: 'تقرير العملاء', en: 'Clients Report' },
    description: { ar: 'قائمة كاملة بكل العملاء وبياناتهم', en: 'Full list of all clients with their data' },
    icon: Building2,
    color: 'bg-sky-50',
    iconColor: 'text-sky-600',
    filters: ['type'],
  },
  {
    key: 'contracts',
    title: { ar: 'تقرير العقود', en: 'Contracts Report' },
    description: { ar: 'كل العقود مع حالتها وقيمتها', en: 'All contracts with status and value' },
    icon: FileText,
    color: 'bg-brand-50',
    iconColor: 'text-brand-600',
    filters: ['dateRange'],
  },
  {
    key: 'visits',
    title: { ar: 'تقرير الزيارات', en: 'Visits Report' },
    description: { ar: 'كل زيارات المناديب للعملاء', en: 'All sales rep visits to clients' },
    icon: MapPin,
    color: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    filters: ['rep', 'dateRange'],
  },
  {
    key: 'payments',
    title: { ar: 'تقرير التحصيل', en: 'Collections Report' },
    description: { ar: 'كل المبالغ المحصلة من العملاء', en: 'All collected amounts from clients' },
    icon: TrendingUp,
    color: 'bg-amber-50',
    iconColor: 'text-amber-600',
    filters: ['dateRange'],
  },
  {
    key: 'team',
    title: { ar: 'أداء فريق المبيعات', en: 'Sales Team Performance' },
    description: { ar: 'تقرير شامل عن أداء كل مندوب', en: 'Comprehensive report on each rep performance' },
    icon: Users,
    color: 'bg-violet-50',
    iconColor: 'text-violet-600',
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

export default function Reports() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [generating, setGenerating] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState<Record<string, any>>({});

  const downloadFile = (data: BlobPart, filename: string, mimeType = 'application/pdf') => {
    const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = (data: any[], filename: string, headers: { key: string; label: string }[]) => {
    const BOM = '\uFEFF';
    const headerRow = headers.map(h => `"${h.label}"`).join(',');
    const dataRows = data.map(row =>
      headers.map(h => {
        const val = h.key.split('.').reduce((acc, k) => acc?.[k], row);
        return `"${(val ?? '').toString().replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = BOM + [headerRow, ...dataRows].join('\n');
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  };

  const generate = async (key: string, format: 'pdf' | 'csv' = 'pdf') => {
    setGenerating(`${key}-${format}`);
    const f = filters[key] || {};
    try {
      switch (key) {
        case 'clients':
          if (format === 'pdf') {
            const res = await pdfApi.clientReport({ type: f.type || undefined });
            downloadFile(res.data, 'Clients_Report.pdf');
          } else {
            const res = await clientsApi.getAll({ type: f.type || undefined });
            exportToCSV(res.data, 'Clients.csv', [
              { key: 'companyName', label: isAr ? 'الشركة' : 'Company' },
              { key: 'contactPerson', label: isAr ? 'جهة الاتصال' : 'Contact' },
              { key: 'phone', label: isAr ? 'الهاتف' : 'Phone' },
              { key: 'email', label: isAr ? 'البريد' : 'Email' },
              { key: 'industry', label: isAr ? 'القطاع' : 'Industry' },
              { key: 'clientType', label: isAr ? 'النوع' : 'Type' },
              { key: 'hotel.name', label: isAr ? 'الفندق' : 'Hotel' },
              { key: 'salesRep.name', label: isAr ? 'المندوب' : 'Sales Rep' },
            ]);
          }
          break;
        case 'contracts': {
          const res = await contractsApi.getAll({});
          exportToCSV(res.data, 'Contracts.csv', [
            { key: 'contractRef', label: isAr ? 'رقم العقد' : 'Ref' },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'hotel.name', label: isAr ? 'الفندق' : 'Hotel' },
            { key: 'salesRep.name', label: isAr ? 'المندوب' : 'Rep' },
            { key: 'roomsCount', label: isAr ? 'الغرف' : 'Rooms' },
            { key: 'ratePerRoom', label: isAr ? 'السعر/غرفة' : 'Rate' },
            { key: 'totalValue', label: isAr ? 'القيمة' : 'Value' },
            { key: 'collectedAmount', label: isAr ? 'المحصل' : 'Collected' },
            { key: 'status', label: isAr ? 'الحالة' : 'Status' },
            { key: 'startDate', label: isAr ? 'البداية' : 'Start' },
            { key: 'endDate', label: isAr ? 'النهاية' : 'End' },
          ]);
          break;
        }
        case 'visits': {
          const res = await visitsApi.getAll();
          exportToCSV(res.data, 'Visits.csv', [
            { key: 'visitDate', label: isAr ? 'التاريخ' : 'Date' },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'salesRep.name', label: isAr ? 'المندوب' : 'Rep' },
            { key: 'visitType', label: isAr ? 'النوع' : 'Type' },
            { key: 'purpose', label: isAr ? 'الغرض' : 'Purpose' },
            { key: 'outcome', label: isAr ? 'النتيجة' : 'Outcome' },
            { key: 'nextFollowUp', label: isAr ? 'المتابعة' : 'Follow-up' },
          ]);
          break;
        }
        case 'payments': {
          const res = await paymentsApi.getAll();
          exportToCSV(res.data, 'Payments.csv', [
            { key: 'paymentDate', label: isAr ? 'التاريخ' : 'Date' },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'contract.contractRef', label: isAr ? 'العقد' : 'Contract' },
            { key: 'amount', label: isAr ? 'المبلغ' : 'Amount' },
            { key: 'paymentType', label: isAr ? 'الطريقة' : 'Method' },
            { key: 'reference', label: isAr ? 'المرجع' : 'Reference' },
            { key: 'collector.name', label: isAr ? 'المُحصِّل' : 'Collected By' },
          ]);
          break;
        }
        case 'team': {
          const res = await usersApi.getAll();
          const reps = res.data.filter((u: any) => ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role));
          exportToCSV(reps, 'Team.csv', [
            { key: 'name', label: isAr ? 'الاسم' : 'Name' },
            { key: 'email', label: isAr ? 'البريد' : 'Email' },
            { key: 'phone', label: isAr ? 'الهاتف' : 'Phone' },
            { key: 'role', label: isAr ? 'الدور' : 'Role' },
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
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'فشل إنشاء التقرير' : 'Failed to generate report'));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className={isAr ? 'text-right' : 'text-left'}>
        <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'التقارير' : 'Reports'}</h1>
        <p className="text-brand-400 text-sm mt-0.5">
          {isAr ? 'كل التقارير الإدارية في مكان واحد' : 'All management reports in one place'}
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(r => (
          <div key={r.key} className="card p-5 hover:shadow-md transition-shadow">
            <div className={`flex items-start justify-between ${isAr ? 'flex-row-reverse' : ''}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.color} flex-shrink-0`}>
                <r.icon className={`w-6 h-6 ${r.iconColor}`} />
              </div>
            </div>
            <div className={`mt-4 ${isAr ? 'text-right' : 'text-left'}`}>
              <h3 className="font-bold text-brand-900">{isAr ? r.title.ar : r.title.en}</h3>
              <p className="text-xs text-brand-400 mt-1 leading-relaxed">{isAr ? r.description.ar : r.description.en}</p>
            </div>

            {/* Filters */}
            {r.filters?.includes('type') && (
              <div className="mt-3">
                <select className="input text-xs"
                  value={filters[r.key]?.type || ''}
                  onChange={e => setFilters(p => ({ ...p, [r.key]: { ...p[r.key], type: e.target.value } }))}>
                  <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
                  <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                  <option value="lead">{isAr ? 'محتمل' : 'Lead'}</option>
                  <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className={`flex gap-2 mt-4 ${isAr ? 'flex-row-reverse' : ''}`}>
              {r.key === 'clients' && (
                <button onClick={() => generate(r.key, 'pdf')} disabled={generating === `${r.key}-pdf`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                  {generating === `${r.key}-pdf` ? '...' : <><Download className="w-3.5 h-3.5" /> PDF</>}
                </button>
              )}
              <button onClick={() => generate(r.key, 'csv')} disabled={generating === `${r.key}-csv`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                {generating === `${r.key}-csv` ? '...' : <><FileSpreadsheet className="w-3.5 h-3.5" /> Excel/CSV</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="card p-4 bg-brand-50/30 border-brand-200">
        <p className={`text-xs text-brand-600 ${isAr ? 'text-right' : 'text-left'}`}>
          💡 {isAr
            ? 'ملفات Excel/CSV يمكن فتحها في Microsoft Excel أو Google Sheets. ملفات PDF جاهزة للطباعة والمشاركة.'
            : 'Excel/CSV files can be opened in Microsoft Excel or Google Sheets. PDF files are ready to print and share.'}
        </p>
      </div>
    </div>
  );
}
