import { useEffect, useState, useMemo } from 'react';
import {
  Download, Building2, FileText, TrendingUp, Users, MapPin, Target as TargetIcon,
  FileSpreadsheet, Filter, CreditCard, Search, BedDouble, Receipt, AlertCircle,
  Sparkles, BarChart3,
} from 'lucide-react';
import {
  pdfApi, contractsApi, clientsApi, visitsApi, paymentsApi, usersApi,
  bookingsApi, quotesApi, hotelsApi, targetsApi,
} from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/Modal';
import { format, parseISO, differenceInDays } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

type FilterKey =
  | 'type' | 'dateRange' | 'rep' | 'status' | 'visitType' | 'paymentMethod'
  | 'bookingStatus' | 'hotel' | 'quoteStatus' | 'ageBucket' | 'targetPeriod';

type Category = 'sales' | 'finance' | 'operations' | 'performance';

interface ReportCard {
  key: string;
  category: Category;
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  icon: any;
  gradient: string;
  filters?: FilterKey[];
  hasPdf?: boolean;
  isNew?: boolean;
}

const CATEGORIES: { key: Category | 'all'; ar: string; en: string; Icon: any }[] = [
  { key: 'all',         ar: 'الكل',              en: 'All',         Icon: BarChart3 },
  { key: 'sales',       ar: 'العملاء والمبيعات', en: 'Sales',       Icon: Users },
  { key: 'finance',     ar: 'المالية والعقود',   en: 'Finance',     Icon: CreditCard },
  { key: 'operations',  ar: 'العمليات',          en: 'Operations',  Icon: BedDouble },
  { key: 'performance', ar: 'الأداء',            en: 'Performance', Icon: TrendingUp },
];

const REPORTS: ReportCard[] = [
  // --- Sales ---
  { key: 'clients', category: 'sales', icon: Building2, gradient: 'from-sky-500 to-sky-600',
    title: { ar: 'تقرير العملاء', en: 'Clients Report' },
    description: { ar: 'قائمة كاملة بكل العملاء وبياناتهم', en: 'Full list of all clients with their data' },
    filters: ['type', 'rep', 'dateRange'], hasPdf: true,
  },
  { key: 'visits', category: 'sales', icon: MapPin, gradient: 'from-emerald-500 to-emerald-600',
    title: { ar: 'تقرير الزيارات', en: 'Visits Report' },
    description: { ar: 'كل زيارات المناديب للعملاء', en: 'All sales rep visits to clients' },
    filters: ['rep', 'visitType', 'dateRange'], hasPdf: true,
  },
  { key: 'quotes', category: 'sales', icon: Receipt, gradient: 'from-teal-500 to-teal-600',
    title: { ar: 'تقرير عروض الأسعار', en: 'Quotes Report' },
    description: { ar: 'كل عروض الأسعار بحالتها (معتمد، مرفوض، معلق) والإجمالي', en: 'All price quotes with status and total' },
    filters: ['quoteStatus', 'rep', 'dateRange'], isNew: true,
  },

  // --- Finance ---
  { key: 'contracts', category: 'finance', icon: FileText, gradient: 'from-brand-500 to-brand-600',
    title: { ar: 'تقرير العقود', en: 'Contracts Report' },
    description: { ar: 'كل العقود مع حالتها وقيمتها', en: 'All contracts with status and value' },
    filters: ['status', 'rep', 'dateRange'], hasPdf: true,
  },
  { key: 'payments', category: 'finance', icon: TrendingUp, gradient: 'from-amber-500 to-amber-600',
    title: { ar: 'تقرير التحصيل', en: 'Collections Report' },
    description: { ar: 'كل المبالغ المحصلة من العملاء', en: 'All collected amounts' },
    filters: ['rep', 'paymentMethod', 'dateRange'], hasPdf: true,
  },
  { key: 'paymentMethods', category: 'finance', icon: CreditCard, gradient: 'from-indigo-500 to-indigo-600',
    title: { ar: 'طرق سداد العملاء للعقد', en: 'Payment Methods per Contract' },
    description: { ar: 'بيان طرق السداد (كاش / تحويل / شيك) لكل عقد', en: 'Payment method breakdown per contract' },
    filters: ['rep', 'dateRange'], hasPdf: true,
  },
  { key: 'aging', category: 'finance', icon: AlertCircle, gradient: 'from-red-500 to-red-600',
    title: { ar: 'تقرير المتأخرات (Aging)', en: 'Aging Report' },
    description: { ar: 'المبالغ المستحقة على العملاء مقسّمة بالفترات (30 / 60 / 90 / 90+ يوم)', en: 'Outstanding amounts by age bucket' },
    filters: ['rep', 'ageBucket'], isNew: true,
  },

  // --- Operations ---
  { key: 'bookings', category: 'operations', icon: BedDouble, gradient: 'from-cyan-500 to-cyan-600',
    title: { ar: 'تقرير الحجوزات', en: 'Bookings Report' },
    description: { ar: 'كل الحجوزات (مؤكد، داخل الفندق، خرج، ملغي) بالفندق وتواريخ الإقامة', en: 'All bookings with status and stay dates' },
    filters: ['bookingStatus', 'hotel', 'rep', 'dateRange'], isNew: true,
  },

  // --- Performance ---
  { key: 'team', category: 'performance', icon: Users, gradient: 'from-violet-500 to-violet-600',
    title: { ar: 'أداء فريق المبيعات', en: 'Team Performance' },
    description: { ar: 'تقرير شامل عن أداء كل مندوب', en: 'Comprehensive per-rep performance' },
    hasPdf: true,
  },
  { key: 'targets', category: 'performance', icon: TargetIcon, gradient: 'from-rose-500 to-rose-600',
    title: { ar: 'تقرير التارجت والإنجاز', en: 'Targets & Achievement' },
    description: { ar: 'مقارنة التارجت مع الإنجاز الفعلي لكل مندوب (عقود، زيارات، عملاء، إيرادات)', en: 'Targets vs actual per rep' },
    filters: ['targetPeriod'], isNew: true,
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
  in_person: 'زيارة شخصية', phone: 'هاتف', online: 'أونلاين', site_visit: 'زيارة الموقع',
};
const ROLE_AR: Record<string, string> = {
  admin: 'مسؤول النظام', general_manager: 'المدير العام', vice_gm: 'نائب المدير العام',
  sales_director: 'مدير المبيعات', assistant_sales: 'مساعد مدير المبيعات', sales_rep: 'تنفيذي مبيعات',
  contract_officer: 'مسئول العقود', reservations: 'الحجوزات',
  credit_manager: 'مدير الائتمان', credit_officer: 'موظف الائتمان', systems_info: 'نظم ومعلومات',
};
const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: 'نقدي', bank_transfer: 'تحويل بنكي', cheque: 'شيك', card: 'بطاقة',
};
const SOURCE_AR: Record<string, string> = {
  cold_call: 'اتصال بارد', referral: 'إحالة', exhibition: 'معرض',
  website: 'الموقع الإلكتروني', social_media: 'وسائل التواصل', walk_in: 'زيارة مباشرة', other: 'أخرى',
};
const BOOKING_STATUS_AR: Record<string, string> = {
  pending_reservations: 'بانتظار الحجوزات',
  confirmed: 'مؤكد',
  checked_in: 'داخل الفندق',
  checked_out: 'خرج',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};
const QUOTE_STATUS_AR: Record<string, string> = {
  pending_manager_approval: 'بانتظار موافقة المدير',
  approved: 'معتمد',
  rejected: 'مرفوض',
  closed: 'مُغلق',
};
const AGE_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Reports() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [generating, setGenerating] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [reps, setReps] = useState<{ id: number; name: string }[]>([]);
  const [hotels, setHotels] = useState<{ id: number; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');

  useEffect(() => {
    usersApi.getAll().then(r => {
      setReps((r.data as any[])
        .filter(u => u.isActive && ['sales_rep', 'sales_director', 'assistant_sales'].includes(u.role))
        .map(u => ({ id: u.id, name: u.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')));
    }).catch(() => setReps([]));
    hotelsApi.getAll().then(r => {
      setHotels((r.data as any[]).map(h => ({ id: h.id, name: h.name })));
    }).catch(() => setHotels([]));
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
    const BOM = '﻿';
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

  const generate = async (key: string, fmt: 'pdf' | 'csv' = 'pdf') => {
    setGenerating(`${key}-${fmt}`);
    const f = filters[key] || {};
    try {
      switch (key) {
        case 'clients':
          if (fmt === 'pdf') {
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
          if (fmt === 'pdf') {
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
          if (fmt === 'pdf') {
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
          if (fmt === 'pdf') {
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
          if (fmt === 'pdf') {
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
            const key2 = p.paymentType || 'other';
            byContract[cid][key2] = (byContract[cid][key2] || 0) + Number(p.amount || 0);
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
          if (fmt === 'pdf') {
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

        // === NEW: Bookings ===
        case 'bookings': {
          let { data } = await bookingsApi.getAll({
            status: f.bookingStatus || undefined,
            hotelId: f.hotelId ? parseInt(f.hotelId) : undefined,
            assignedRepId: f.salesRepId ? parseInt(f.salesRepId) : undefined,
            fromDate: f.from || undefined,
            toDate: f.to || undefined,
          });
          if (data.length === 0) {
            alert(isAr ? 'لا توجد حجوزات مطابقة' : 'No bookings match');
            break;
          }
          exportToCSV(data, 'Bookings.csv', [
            { key: 'operaConfirmationNo', label: isAr ? 'رقم الحجز (Opera)' : 'Confirmation #' },
            { key: 'client.companyName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'guestName', label: isAr ? 'الضيف' : 'Guest' },
            { key: 'hotel.name', label: isAr ? 'الفندق' : 'Hotel' },
            { key: 'arrivalDate', label: isAr ? 'الوصول' : 'Arrival', transform: fmtDate },
            { key: 'departureDate', label: isAr ? 'المغادرة' : 'Departure', transform: fmtDate },
            { key: 'nights', label: isAr ? 'الليالي' : 'Nights' },
            { key: 'roomsCount', label: isAr ? 'الغرف' : 'Rooms' },
            { key: 'roomType', label: isAr ? 'نوع الغرفة' : 'Room Type' },
            { key: 'ratePerNight', label: isAr ? 'سعر الليلة' : 'Rate/Night', transform: fmtNum },
            { key: 'totalAmount', label: isAr ? 'الإجمالي' : 'Total', transform: fmtNum },
            { key: 'status', label: isAr ? 'الحالة' : 'Status', transform: v => isAr ? (BOOKING_STATUS_AR[v] || v) : v },
            { key: 'assignedRep.name', label: isAr ? 'المندوب المسؤول' : 'Assigned Rep' },
            { key: 'createdAt', label: isAr ? 'تاريخ الإنشاء' : 'Created', transform: fmtDate },
          ]);
          break;
        }

        // === NEW: Quotes ===
        case 'quotes': {
          let { data } = await quotesApi.listAll(f.quoteStatus || undefined);
          if (f.salesRepId) data = data.filter((q: any) => q.salesRepId === parseInt(f.salesRepId));
          data = applyDateRange(data, 'createdAt', f.from, f.to);
          if (data.length === 0) {
            alert(isAr ? 'لا توجد عروض أسعار مطابقة' : 'No quotes match');
            break;
          }
          exportToCSV(data, 'Quotes.csv', [
            { key: 'reference', label: isAr ? 'المرجع' : 'Reference' },
            { key: 'clientName', label: isAr ? 'الشركة' : 'Company' },
            { key: 'hotelName', label: isAr ? 'الفندق' : 'Hotel' },
            { key: 'salesRepName', label: isAr ? 'المندوب' : 'Rep' },
            { key: 'grandTotal', label: isAr ? 'الإجمالي' : 'Grand Total', transform: fmtNum },
            { key: 'arrivalDate', label: isAr ? 'تاريخ الوصول' : 'Arrival', transform: fmtDate },
            { key: 'validUntil', label: isAr ? 'صالح حتى' : 'Valid Until', transform: fmtDate },
            { key: 'status', label: isAr ? 'الحالة' : 'Status', transform: v => isAr ? (QUOTE_STATUS_AR[v] || v) : v },
            { key: 'approvedByName', label: isAr ? 'اعتمده/رفضه' : 'Decided By' },
            { key: 'approvalNote', label: isAr ? 'ملاحظة' : 'Note' },
            { key: 'createdAt', label: isAr ? 'تاريخ الإنشاء' : 'Created', transform: fmtDate },
          ]);
          break;
        }

        // === NEW: Aging (computed from contracts) ===
        case 'aging': {
          let { data } = await contractsApi.getAll({
            salesRepId: f.salesRepId ? parseInt(f.salesRepId) : undefined,
          });
          // Only approved contracts with money still owed. Age is days since the
          // contract's start date (or creation if startDate is null).
          let rows = data
            .filter((c: any) => c.status === 'approved' && (c.totalValue || 0) > (c.collectedAmount || 0))
            .map((c: any) => {
              const outstanding = (c.totalValue || 0) - (c.collectedAmount || 0);
              const ageDate = c.startDate || c.createdAt;
              const days = Math.max(0, differenceInDays(new Date(), new Date(ageDate)));
              const bucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
              return {
                contractRef: c.contractRef || `#${c.id}`,
                company: c.client?.companyName || '-',
                hotel: c.hotel?.name || '-',
                rep: c.salesRep?.name || '-',
                totalValue: c.totalValue || 0,
                collected: c.collectedAmount || 0,
                outstanding,
                days,
                bucket,
                startDate: ageDate,
              };
            });
          if (f.ageBucket) rows = rows.filter((r: any) => r.bucket === f.ageBucket);
          rows.sort((a: any, b: any) => b.days - a.days);
          if (rows.length === 0) {
            alert(isAr ? 'لا توجد متأخرات مطابقة' : 'No outstanding amounts match');
            break;
          }
          exportToCSV(rows, 'Aging_Report.csv', [
            { key: 'contractRef',  label: isAr ? 'العقد' : 'Contract' },
            { key: 'company',      label: isAr ? 'الشركة' : 'Company' },
            { key: 'hotel',        label: isAr ? 'الفندق' : 'Hotel' },
            { key: 'rep',          label: isAr ? 'المندوب' : 'Rep' },
            { key: 'totalValue',   label: isAr ? 'القيمة' : 'Total Value',  transform: fmtNum },
            { key: 'collected',    label: isAr ? 'المحصل' : 'Collected',    transform: fmtNum },
            { key: 'outstanding',  label: isAr ? 'المتبقي' : 'Outstanding', transform: fmtNum },
            { key: 'days',         label: isAr ? 'عمر الدين (يوم)' : 'Age (days)' },
            { key: 'bucket',       label: isAr ? 'الفترة' : 'Bucket' },
            { key: 'startDate',    label: isAr ? 'تاريخ البداية' : 'Start Date', transform: fmtDate },
          ]);
          break;
        }

        // === NEW: Targets ===
        case 'targets': {
          const period = f.period || 'monthly';
          const year = f.year ? parseInt(f.year) : new Date().getFullYear();
          const month = f.month ? parseInt(f.month) : new Date().getMonth() + 1;
          const quarter = f.quarter ? parseInt(f.quarter) : undefined;
          const params: any = { period, year };
          if (period === 'monthly') params.month = month;
          if (period === 'quarterly' && quarter) params.quarter = quarter;
          const { data } = await targetsApi.getReport(params);
          if (!data || data.length === 0) {
            alert(isAr ? 'لا توجد بيانات تارجت لهذه الفترة' : 'No targets data for this period');
            break;
          }
          const rows = data.map((t: any) => ({
            name: t.user?.name || '-',
            role: t.user?.role || '-',
            targetContracts: t.targetContracts || 0,
            actualContracts: t.actual?.contracts || 0,
            contractsPct: t.progress?.contracts || 0,
            targetVisits: t.targetVisits || 0,
            actualVisits: t.actual?.visits || 0,
            visitsPct: t.progress?.visits || 0,
            targetClients: t.targetClients || 0,
            actualClients: t.actual?.clients || 0,
            clientsPct: t.progress?.clients || 0,
            targetRevenue: t.targetRevenue || 0,
            actualRevenue: t.actual?.revenue || 0,
            revenuePct: t.progress?.revenue || 0,
          }));
          const fileName = period === 'monthly'
            ? `Targets_${year}-${String(month).padStart(2, '0')}.csv`
            : `Targets_${year}-Q${quarter || 1}.csv`;
          exportToCSV(rows, fileName, [
            { key: 'name',            label: isAr ? 'المندوب' : 'Rep' },
            { key: 'role',            label: isAr ? 'الدور' : 'Role', transform: v => isAr ? (ROLE_AR[v] || v) : v },
            { key: 'targetContracts', label: isAr ? 'تارجت عقود' : 'Target Contracts' },
            { key: 'actualContracts', label: isAr ? 'فعلي عقود' : 'Actual Contracts' },
            { key: 'contractsPct',    label: isAr ? '% عقود' : 'Contracts %' },
            { key: 'targetVisits',    label: isAr ? 'تارجت زيارات' : 'Target Visits' },
            { key: 'actualVisits',    label: isAr ? 'فعلي زيارات' : 'Actual Visits' },
            { key: 'visitsPct',       label: isAr ? '% زيارات' : 'Visits %' },
            { key: 'targetClients',   label: isAr ? 'تارجت عملاء' : 'Target Clients' },
            { key: 'actualClients',   label: isAr ? 'فعلي عملاء' : 'Actual Clients' },
            { key: 'clientsPct',      label: isAr ? '% عملاء' : 'Clients %' },
            { key: 'targetRevenue',   label: isAr ? 'تارجت إيرادات' : 'Target Revenue', transform: fmtNum },
            { key: 'actualRevenue',   label: isAr ? 'فعلي إيرادات' : 'Actual Revenue', transform: fmtNum },
            { key: 'revenuePct',      label: isAr ? '% إيرادات' : 'Revenue %' },
          ]);
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

  // Filter cards by category tab + search term. Search matches title or
  // description in the current language so users can find a report by
  // typing a few characters of its name.
  const filteredReports = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return REPORTS.filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (!q) return true;
      const title = (isAr ? r.title.ar : r.title.en).toLowerCase();
      const desc  = (isAr ? r.description.ar : r.description.en).toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [searchTerm, categoryFilter, isAr]);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={isAr ? 'text-right' : 'text-left'}>
        <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'التقارير' : 'Reports'}</h1>
        <p className="text-brand-400 text-sm mt-0.5">
          {isAr
            ? `${REPORTS.length} تقرير متاح • اضغط على أي بطاقة لاختيار الفلاتر والتنزيل`
            : `${REPORTS.length} reports available • Click a card to pick filters and download`}
        </p>
      </div>

      {/* Search + category tabs sit together in one card so the filter UI
          for the catalog itself feels like a single control surface. */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-brand-400`} />
          <input className={`input ${isAr ? 'pr-10' : 'pl-10'}`}
            placeholder={isAr ? 'بحث في التقارير...' : 'Search reports...'}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
          {CATEGORIES.map(cat => {
            const count = cat.key === 'all'
              ? REPORTS.length
              : REPORTS.filter(r => r.category === cat.key).length;
            const active = categoryFilter === cat.key;
            return (
              <button key={cat.key} type="button"
                onClick={() => setCategoryFilter(cat.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
                }`}>
                <cat.Icon className="w-3.5 h-3.5" />
                {isAr ? cat.ar : cat.en}
                <span className={`text-[10px] ${active ? 'opacity-80' : 'text-brand-400'}`}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="card py-12 text-center">
          <Search className="w-10 h-10 text-brand-200 mx-auto mb-3" />
          <p className="text-brand-500 font-semibold">{isAr ? 'لا توجد تقارير مطابقة للبحث' : 'No matching reports'}</p>
          {(searchTerm || categoryFilter !== 'all') && (
            <button className="text-xs px-3 py-1.5 mt-3 rounded-full border border-brand-200 text-brand-600 hover:bg-brand-50"
              onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}>
              {isAr ? 'مسح البحث' : 'Clear search'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map(r => {
            const activeFilters = filters[r.key] ? Object.values(filters[r.key]).filter(v => v).length : 0;
            return (
              <button key={r.key}
                onClick={() => setOpenModal(r.key)}
                className="group relative card p-5 text-start hover:shadow-elevated hover:border-brand-300 transition-all overflow-hidden">
                {/* Top accent strip — gradient matching the icon. Subtle tell
                    that the card is grouped/colored by category. */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${r.gradient}`} />

                <div className={`flex items-start justify-between gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${r.gradient} text-white shadow-sm`}>
                    <r.icon className="w-6 h-6" />
                  </div>
                  <div className={`flex items-center gap-1.5 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                    {r.isNew && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <Sparkles className="w-2.5 h-2.5" /> {isAr ? 'جديد' : 'NEW'}
                      </span>
                    )}
                    {activeFilters > 0 && (
                      <span className="inline-flex items-center gap-1 bg-brand-100 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <Filter className="w-3 h-3" /> {activeFilters}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`mt-4 ${isAr ? 'text-right' : 'text-left'}`}>
                  <h3 className="font-bold text-brand-900 text-base">{isAr ? r.title.ar : r.title.en}</h3>
                  <p className="text-xs text-brand-400 mt-1 leading-relaxed">{isAr ? r.description.ar : r.description.en}</p>
                </div>

                {/* Format badges — small chips telling users which formats this
                    report supports so they don't have to open the modal to find out. */}
                <div className={`mt-4 pt-3 border-t border-brand-100 flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  {r.hasPdf && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" /> PDF
                    </span>
                  )}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    <FileSpreadsheet className="w-2.5 h-2.5" /> Excel
                  </span>
                  <span className={`text-[10px] text-brand-400 ${isAr ? 'mr-auto' : 'ml-auto'}`}>
                    {isAr ? 'اضغط للتنزيل' : 'Click to download'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

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

            {current.filters?.includes('bookingStatus') && (
              <div>
                <label className="label">{isAr ? 'حالة الحجز' : 'Booking Status'}</label>
                <select className="input" value={f.bookingStatus || ''} onChange={e => setF({ bookingStatus: e.target.value })}>
                  <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
                  {Object.entries(BOOKING_STATUS_AR).map(([k, v]) => (
                    <option key={k} value={k}>{isAr ? v : k}</option>
                  ))}
                </select>
              </div>
            )}

            {current.filters?.includes('hotel') && hotels.length > 0 && (
              <div>
                <label className="label">{isAr ? 'الفندق' : 'Hotel'}</label>
                <select className="input" value={f.hotelId || ''} onChange={e => setF({ hotelId: e.target.value })}>
                  <option value="">{isAr ? 'كل الفنادق' : 'All hotels'}</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            )}

            {current.filters?.includes('quoteStatus') && (
              <div>
                <label className="label">{isAr ? 'حالة العرض' : 'Quote Status'}</label>
                <select className="input" value={f.quoteStatus || ''} onChange={e => setF({ quoteStatus: e.target.value })}>
                  <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
                  {Object.entries(QUOTE_STATUS_AR).map(([k, v]) => (
                    <option key={k} value={k}>{isAr ? v : k}</option>
                  ))}
                </select>
              </div>
            )}

            {current.filters?.includes('ageBucket') && (
              <div>
                <label className="label">{isAr ? 'الفترة (عمر الدين)' : 'Age Bucket'}</label>
                <select className="input" value={f.ageBucket || ''} onChange={e => setF({ ageBucket: e.target.value })}>
                  <option value="">{isAr ? 'كل الفترات' : 'All buckets'}</option>
                  {AGE_BUCKETS.map(b => (
                    <option key={b} value={b}>
                      {isAr ? (b === '90+' ? 'أكثر من 90 يوم' : `${b} يوم`) : `${b} days`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {current.filters?.includes('targetPeriod') && (
              <div className="space-y-3">
                <div>
                  <label className="label">{isAr ? 'النوع' : 'Period'}</label>
                  <select className="input" value={f.period || 'monthly'} onChange={e => setF({ period: e.target.value })}>
                    <option value="monthly">{isAr ? 'شهري' : 'Monthly'}</option>
                    <option value="quarterly">{isAr ? 'ربع سنوي' : 'Quarterly'}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'السنة' : 'Year'}</label>
                    <select className="input" value={f.year || currentYear} onChange={e => setF({ year: e.target.value })}>
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  {(f.period || 'monthly') === 'monthly' ? (
                    <div>
                      <label className="label">{isAr ? 'الشهر' : 'Month'}</label>
                      <select className="input" value={f.month || (new Date().getMonth() + 1)} onChange={e => setF({ month: e.target.value })}>
                        {(isAr ? MONTHS_AR : MONTHS_EN).map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="label">{isAr ? 'الربع' : 'Quarter'}</label>
                      <select className="input" value={f.quarter || 1} onChange={e => setF({ quarter: e.target.value })}>
                        {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                      </select>
                    </div>
                  )}
                </div>
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
