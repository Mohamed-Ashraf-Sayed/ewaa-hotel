import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Search, RefreshCw, Inbox as InboxIcon, MailOpen, CheckCheck, Building2, Paperclip } from 'lucide-react';
import { inboxApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

type Tab = 'all' | 'unread' | 'reservations';

interface InboxItem {
  id: number;
  fromEmail: string;
  fromName?: string | null;
  toEmail?: string | null;
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  receivedAt: string;
  category: string;
  isRead: boolean;
  isReplied: boolean;
  hasAttachments: boolean;
  attachmentsJson?: string | null;
  clientId?: number | null;
  client?: {
    id: number;
    companyName: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    salesRep?: { id: number; name: string };
  } | null;
}

export default function Inbox() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const canPoll = hasRole('admin', 'general_manager', 'vice_gm', 'reservations');

  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('unread');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await inboxApi.list({ take: 200 });
      setItems(res.data.items);
      setUnread(res.data.unread);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => {
    let list = items;
    if (tab === 'unread') list = list.filter(i => !i.isRead);
    if (tab === 'reservations') list = list.filter(i => i.category === 'reservations');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.subject.toLowerCase().includes(q) ||
        i.fromEmail.toLowerCase().includes(q) ||
        (i.fromName?.toLowerCase().includes(q)) ||
        (i.client?.companyName?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, tab, search]);

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    const item = items.find(i => i.id === id);
    if (item && !item.isRead) {
      try {
        await inboxApi.markRead(id, true);
        setItems(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
        setUnread(prev => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
  };

  const handleMarkAllRead = async () => {
    if (!confirm(isAr ? 'تعليم كل الرسائل كمقروءة؟' : 'Mark all messages as read?')) return;
    await inboxApi.markAllRead();
    await load();
  };

  const handlePollNow = async () => {
    setPolling(true);
    try {
      await inboxApi.pollNow();
      // Wait 2s then reload — the poll runs async on the server
      setTimeout(() => { load(); setPolling(false); }, 2500);
    } catch (err: any) {
      setPolling(false);
      alert(err?.response?.data?.message || (isAr ? 'فشل التحديث' : 'Refresh failed'));
    }
  };

  const counts = useMemo(() => ({
    all: items.length,
    unread: items.filter(i => !i.isRead).length,
    reservations: items.filter(i => i.category === 'reservations').length,
  }), [items]);

  const TabBtn = ({ id, label, count, accent }: { id: Tab; label: string; count: number; accent?: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        tab === id ? 'border-brand-500 text-brand-700' : 'border-transparent text-brand-400 hover:text-brand-600'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ms-1.5 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${accent || 'bg-brand-100 text-brand-700'}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between flex-wrap gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900 inline-flex items-center gap-2">
            <InboxIcon className="w-6 h-6 text-brand-500" /> {isAr ? 'الوارد - بريد العملاء' : 'Inbox — Client Emails'}
          </h1>
          <p className="text-brand-400 text-sm mt-0.5">
            {isAr
              ? 'إيميلات العملاء المسجّلين تظهر هنا تلقائياً'
              : 'Emails from registered clients show up here automatically'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {isAr ? 'إعادة تحميل' : 'Reload'}
          </button>
          {canPoll && (
            <button onClick={handlePollNow} className="btn-secondary text-sm" disabled={polling}>
              <Mail className="w-4 h-4" />
              {polling ? (isAr ? 'جاري التحديث...' : 'Fetching...') : (isAr ? 'فحص البريد الآن' : 'Fetch Now')}
            </button>
          )}
          {counts.unread > 0 && (
            <button onClick={handleMarkAllRead} className="btn-secondary text-sm">
              <CheckCheck className="w-4 h-4" /> {isAr ? 'تعليم الكل كمقروء' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      <div className={`flex border-b border-brand-100 ${isAr ? 'flex-row-reverse' : ''}`}>
        <TabBtn id="all" label={isAr ? 'الكل' : 'All'} count={counts.all} />
        <TabBtn id="unread" label={isAr ? 'غير مقروءة' : 'Unread'} count={counts.unread} accent="bg-brand-500 text-white" />
        <TabBtn id="reservations" label={isAr ? 'الحجوزات' : 'Reservations'} count={counts.reservations} accent="bg-violet-100 text-violet-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* List */}
        <div className="lg:col-span-5 card p-3 max-h-[75vh] overflow-y-auto">
          <div className="relative mb-3">
            <Search className={`absolute top-3 w-4 h-4 text-brand-400 ${isAr ? 'right-3' : 'left-3'}`} />
            <input
              className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
              placeholder={isAr ? 'ابحث في الموضوع، الشركة، المرسل...' : 'Search subject, company, sender...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="py-12 text-center"><div className="w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-brand-400">
              <MailOpen className="w-10 h-10 mx-auto mb-2 text-brand-200" />
              {isAr ? 'لا توجد رسائل' : 'No messages'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full text-start p-3 rounded-lg border transition-colors ${
                    selectedId === item.id
                      ? 'bg-brand-50 border-brand-300'
                      : item.isRead
                        ? 'border-brand-100 hover:bg-brand-50/50'
                        : 'bg-white border-brand-200 hover:bg-brand-50/50'
                  } ${isAr ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center justify-between gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${item.isRead ? 'text-brand-600' : 'font-bold text-brand-900'}`}>
                        {item.fromName || item.fromEmail}
                      </p>
                      <p className={`text-xs truncate mt-0.5 ${item.isRead ? 'text-brand-400' : 'font-semibold text-brand-700'}`}>
                        {item.subject}
                      </p>
                      {item.client && (
                        <p className="text-[10px] text-brand-500 mt-1 inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {item.client.companyName}
                        </p>
                      )}
                    </div>
                    <div className="text-[10px] text-brand-400 whitespace-nowrap">
                      {formatDistanceToNow(parseISO(item.receivedAt), { locale, addSuffix: false })}
                      {item.hasAttachments && <Paperclip className="w-3 h-3 inline ms-1" />}
                      {!item.isRead && <span className="block w-2 h-2 rounded-full bg-brand-500 ms-auto mt-1" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-7 card p-5 max-h-[75vh] overflow-y-auto">
          {!selected ? (
            <div className="py-20 text-center text-brand-400">
              <MailOpen className="w-12 h-12 mx-auto mb-3 text-brand-200" />
              <p>{isAr ? 'اختر رسالة لعرضها' : 'Select a message to read'}</p>
            </div>
          ) : (
            <>
              <div className={`mb-4 pb-3 border-b border-brand-100 ${isAr ? 'text-right' : ''}`}>
                <h2 className="text-lg font-bold text-brand-900">{selected.subject}</h2>
                <div className={`flex items-center gap-3 mt-2 text-xs text-brand-500 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="font-semibold">
                    {selected.fromName ? `${selected.fromName} <${selected.fromEmail}>` : selected.fromEmail}
                  </span>
                  <span className="text-brand-300">·</span>
                  <span>{format(parseISO(selected.receivedAt), 'dd MMM yyyy HH:mm', { locale })}</span>
                </div>
                {selected.client && (
                  <Link
                    to={`/clients/${selected.client.id}`}
                    className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 ${isAr ? 'flex-row-reverse' : ''}`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {selected.client.companyName}
                    {selected.client.salesRep?.name && <span className="text-brand-400">· {isAr ? 'المندوب' : 'Rep'}: {selected.client.salesRep.name}</span>}
                  </Link>
                )}
              </div>

              {selected.hasAttachments && selected.attachmentsJson && (
                <div className={`mb-3 p-3 rounded-lg bg-brand-50/50 border border-brand-100 ${isAr ? 'text-right' : ''}`}>
                  <p className="text-xs font-semibold text-brand-700 mb-2 inline-flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> {isAr ? 'المرفقات' : 'Attachments'}:
                  </p>
                  <ul className="text-xs text-brand-600 space-y-1">
                    {(JSON.parse(selected.attachmentsJson) as { filename: string; size: number; contentType: string }[]).map((a, i) => (
                      <li key={i}>📎 {a.filename} ({(a.size / 1024).toFixed(1)} KB)</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-brand-400 mt-1">
                    {isAr ? 'المرفقات لا تُحمَّل تلقائياً — راجع البريد الأصلي للحصول عليها' : 'Attachments are not auto-downloaded — see original mail'}
                  </p>
                </div>
              )}

              {selected.bodyHtml ? (
                <div
                  className={`prose prose-sm max-w-none text-brand-800 ${isAr ? 'text-right' : ''}`}
                  dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
                />
              ) : (
                <pre className={`whitespace-pre-wrap text-sm text-brand-800 font-sans ${isAr ? 'text-right' : ''}`}>
                  {selected.bodyText || ''}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
