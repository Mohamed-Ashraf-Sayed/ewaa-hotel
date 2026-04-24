import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Bell, CheckCircle, Trash2, Sparkles, RefreshCw, Pencil, CalendarDays } from 'lucide-react';
import { remindersApi, clientsApi, localEventsApi } from '../services/api';
import Modal from '../components/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, isToday, isTomorrow, isPast, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface Reminder {
  id: number; title: string; description?: string; reminderDate: string;
  reminderTime?: string; type: string; isCompleted: boolean;
  client?: { id: number; companyName: string };
}

interface LocalEvent {
  id: number; title: string; titleEn?: string; description?: string;
  eventDate: string; endDate?: string; type: string; color?: string;
  isRecurring: boolean; source: 'manual' | 'nager';
  createdBy?: { id: number; name: string };
}

const TYPES_AR = [
  { value: 'call', label: 'مكالمة', icon: '📞', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'visit', label: 'زيارة', icon: '📍', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'meeting', label: 'اجتماع', icon: '🤝', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'follow_up', label: 'متابعة', icon: '🔄', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'general', label: 'تذكير عام', icon: '🔔', color: 'bg-brand-50 text-brand-700 border-brand-200' },
];
const TYPES_EN = [
  { value: 'call', label: 'Call', icon: '📞', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'visit', label: 'Visit', icon: '📍', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'meeting', label: 'Meeting', icon: '🤝', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'follow_up', label: 'Follow-up', icon: '🔄', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'general', label: 'General', icon: '🔔', color: 'bg-brand-50 text-brand-700 border-brand-200' },
];

const EVENT_TYPES_AR = [
  { value: 'official_holiday', label: 'إجازة رسمية', icon: '🏛️', defaultColor: '#DC2626' },
  { value: 'religious', label: 'مناسبة دينية', icon: '🕌', defaultColor: '#16A34A' },
  { value: 'school', label: 'إجازة دراسية', icon: '🎓', defaultColor: '#2563EB' },
  { value: 'season', label: 'موسم', icon: '🌴', defaultColor: '#D97706' },
  { value: 'occasion', label: 'مناسبة', icon: '🎉', defaultColor: '#7C3AED' },
];
const EVENT_TYPES_EN = [
  { value: 'official_holiday', label: 'Official Holiday', icon: '🏛️', defaultColor: '#DC2626' },
  { value: 'religious', label: 'Religious', icon: '🕌', defaultColor: '#16A34A' },
  { value: 'school', label: 'School Break', icon: '🎓', defaultColor: '#2563EB' },
  { value: 'season', label: 'Season', icon: '🌴', defaultColor: '#D97706' },
  { value: 'occasion', label: 'Occasion', icon: '🎉', defaultColor: '#7C3AED' },
];

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const TYPES = isAr ? TYPES_AR : TYPES_EN;
  const EVENT_TYPES = isAr ? EVENT_TYPES_AR : EVENT_TYPES_EN;
  const DAYS = isAr ? DAYS_AR : DAYS_EN;
  const MONTHS = isAr ? MONTHS_AR : MONTHS_EN;

  const canManageEvents = hasRole('admin', 'general_manager', 'vice_gm', 'sales_director');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // Event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const emptyEventForm = { title: '', titleEn: '', description: '', eventDate: '', endDate: '', type: 'official_holiday', color: '', isRecurring: false };
  const [eventForm, setEventForm] = useState(emptyEventForm);

  const emptyForm = { title: '', description: '', reminderDate: '', reminderTime: '', type: 'general', clientId: '' };
  const [form, setForm] = useState(emptyForm);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const load = () => {
    setLoading(true);
    Promise.all([
      remindersApi.getAll({ month, year }),
      localEventsApi.getAll({ month, year }),
    ])
      .then(([r, e]) => { setReminders(r.data); setEvents(e.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month, year]);
  useEffect(() => { clientsApi.getAll().then(r => setClients(r.data)).catch(() => {}); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await remindersApi.create({
        ...form,
        clientId: form.clientId ? parseInt(form.clientId) : null,
      });
      setShowModal(false); setForm(emptyForm); load();
    } catch { alert(isAr ? 'حدث خطأ' : 'Error'); }
    finally { setSaving(false); }
  };

  const toggleComplete = async (id: number, current: boolean) => {
    await remindersApi.update(id, { isCompleted: !current });
    load();
  };

  const deleteReminder = async (id: number) => {
    if (!confirm(isAr ? 'حذف التذكير؟' : 'Delete reminder?')) return;
    await remindersApi.delete(id); load();
  };

  const openAddForDate = (date: Date) => {
    setSelectedDate(date);
    setForm({ ...emptyForm, reminderDate: format(date, 'yyyy-MM-dd') });
    setShowModal(true);
  };

  const openAddEvent = (date?: Date) => {
    setEditingEvent(null);
    setEventForm({
      ...emptyEventForm,
      eventDate: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    });
    setShowEventModal(true);
  };

  const openEditEvent = (ev: LocalEvent) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      titleEn: ev.titleEn || '',
      description: ev.description || '',
      eventDate: format(parseISO(ev.eventDate), 'yyyy-MM-dd'),
      endDate: ev.endDate ? format(parseISO(ev.endDate), 'yyyy-MM-dd') : '',
      type: ev.type,
      color: ev.color || '',
      isRecurring: ev.isRecurring,
    });
    setShowEventModal(true);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingEvent(true);
    try {
      const payload = {
        ...eventForm,
        endDate: eventForm.endDate || null,
        color: eventForm.color || null,
      };
      if (editingEvent) {
        await localEventsApi.update(editingEvent.id, payload);
      } else {
        await localEventsApi.create(payload);
      }
      setShowEventModal(false); setEventForm(emptyEventForm); setEditingEvent(null); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    } finally { setSavingEvent(false); }
  };

  const deleteEvent = async (id: number) => {
    if (!confirm(isAr ? 'حذف الحدث؟' : 'Delete event?')) return;
    try {
      await localEventsApi.delete(id); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const syncHolidays = async () => {
    setSyncing(true);
    try {
      const r = await localEventsApi.sync();
      const totals = (r.data?.results || []).reduce((a: any, x: any) => ({
        added: a.added + (x.added || 0), updated: a.updated + (x.updated || 0),
      }), { added: 0, updated: 0 });
      alert(isAr
        ? `تمت المزامنة: ${totals.added} جديد، ${totals.updated} تحديث`
        : `Synced: ${totals.added} new, ${totals.updated} updated`);
      load();
    } catch {
      alert(isAr ? 'فشل الاتصال بخدمة الأعياد' : 'Holiday sync failed');
    } finally { setSyncing(false); }
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month, 1));

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart); // 0=Sun

  const getTypeInfo = (type: string) => TYPES.find(t => t.value === type) || TYPES[4];
  const getEventTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[4];

  const getDayEvents = (day: Date) => events.filter(e => {
    const start = startOfDay(parseISO(e.eventDate));
    const end = e.endDate ? endOfDay(parseISO(e.endDate)) : endOfDay(start);
    return isWithinInterval(day, { start, end });
  });

  // Today's and upcoming reminders
  const todayReminders = reminders.filter(r => isToday(parseISO(r.reminderDate)) && !r.isCompleted);
  const upcomingReminders = reminders.filter(r => {
    const d = parseISO(r.reminderDate);
    return !isPast(d) && !isToday(d) && !r.isCompleted;
  }).slice(0, 5);

  // Upcoming events (from today through end of view)
  const now = new Date();
  const upcomingEvents = events
    .filter(e => {
      const end = e.endDate ? parseISO(e.endDate) : parseISO(e.eventDate);
      return differenceInCalendarDays(end, now) >= 0;
    })
    .sort((a, b) => parseISO(a.eventDate).getTime() - parseISO(b.eventDate).getTime())
    .slice(0, 6);

  // Today's events
  const todayEvents = events.filter(e => {
    const start = startOfDay(parseISO(e.eventDate));
    const end = e.endDate ? endOfDay(parseISO(e.endDate)) : endOfDay(start);
    return isWithinInterval(new Date(), { start, end });
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'التقويم والتذكيرات' : 'Calendar & Reminders'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'جدّول مواعيدك وتابع المواسم والإجازات' : 'Schedule appointments, track seasons & holidays'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManageEvents && (
            <>
              <button
                onClick={syncHolidays}
                disabled={syncing}
                className="btn-secondary"
                title={isAr ? 'مزامنة من الانترنت' : 'Sync from internet'}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {isAr ? 'مزامنة الأعياد' : 'Sync Holidays'}
              </button>
              <button onClick={() => openAddEvent()} className="btn-secondary">
                <Sparkles className="w-4 h-4" /> {isAr ? 'إضافة حدث' : 'Add Event'}
              </button>
            </>
          )}
          <button className="btn-primary" onClick={() => { setForm({ ...emptyForm, reminderDate: format(new Date(), 'yyyy-MM-dd') }); setShowModal(true); }}>
            <Plus className="w-4 h-4" /> {isAr ? 'تذكير جديد' : 'New Reminder'}
          </button>
        </div>
      </div>

      {/* Today's events banner */}
      {todayEvents.length > 0 && (
        <div className="card p-4 border-r-4" style={{ borderRightColor: todayEvents[0].color || '#DC2626' }}>
          <div className="flex items-center gap-2 mb-2 flex-row-reverse">
            <CalendarDays className="w-4 h-4" style={{ color: todayEvents[0].color || '#DC2626' }} />
            <h3 className="font-bold text-brand-900">{isAr ? 'اليوم' : 'Today'}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayEvents.map(ev => {
              const ti = getEventTypeInfo(ev.type);
              return (
                <span key={ev.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: (ev.color || ti.defaultColor) + '20', color: ev.color || ti.defaultColor }}>
                  <span>{ti.icon}</span>
                  <span>{isAr ? ev.title : (ev.titleEn || ev.title)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's reminders alert */}
      {todayReminders.length > 0 && (
        <div className="card p-4 border-r-4 border-r-red-500 bg-red-50/30">
          <div className="flex items-center gap-2 mb-2 flex-row-reverse">
            <Bell className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-brand-900">{isAr ? `تذكيرات اليوم (${todayReminders.length})` : `Today (${todayReminders.length})`}</h3>
          </div>
          <div className="space-y-2">
            {todayReminders.map(r => {
              const ti = getTypeInfo(r.type);
              return (
                <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${ti.color} flex-row-reverse`}>
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <span>{ti.icon}</span>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{r.title}</p>
                      <p className="text-xs opacity-70">{r.client?.companyName}{r.reminderTime ? ` · ${r.reminderTime}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleComplete(r.id, r.isCompleted)} className="p-1 hover:scale-110 transition-transform">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar Grid */}
        <div className="card p-5 lg:col-span-2">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-brand-50 text-brand-500"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-brand-900">{MONTHS[month - 1]} {year}</h2>
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-brand-50 text-brand-500"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Days header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-brand-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 sm:h-28" />
            ))}
            {days.map(day => {
              const dayReminders = reminders.filter(r => isSameDay(parseISO(r.reminderDate), day));
              const dayEvents = getDayEvents(day);
              const today = isToday(day);
              const firstEvent = dayEvents[0];
              const cellBg = firstEvent ? (firstEvent.color || getEventTypeInfo(firstEvent.type).defaultColor) + '12' : '';
              return (
                <button key={day.toISOString()} onClick={() => openAddForDate(day)}
                  className={`h-24 sm:h-28 rounded-lg border p-1.5 text-right hover:bg-brand-50 transition-colors relative overflow-hidden
                    ${today ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600' : 'border-brand-100'}
                    ${isPast(day) && !today ? 'opacity-60' : ''}`}
                  style={firstEvent && !today ? { backgroundColor: cellBg, borderColor: (firstEvent.color || getEventTypeInfo(firstEvent.type).defaultColor) + '40' } : undefined}>
                  <span className={`text-xs font-bold ${today ? 'text-brand-700' : 'text-brand-900'}`}>
                    {day.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {/* Events (shown first) */}
                    {dayEvents.slice(0, 2).map(ev => {
                      const ti = getEventTypeInfo(ev.type);
                      const c = ev.color || ti.defaultColor;
                      return (
                        <div key={`e-${ev.id}`} className="text-[9px] px-1 py-0.5 rounded truncate font-semibold"
                          style={{ backgroundColor: c + '25', color: c }}>
                          {ti.icon} {isAr ? ev.title : (ev.titleEn || ev.title)}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-brand-400 px-1">+{dayEvents.length - 2} {isAr ? 'حدث' : 'events'}</div>
                    )}
                    {/* Reminders */}
                    {dayReminders.slice(0, dayEvents.length > 0 ? 1 : 2).map(r => {
                      const ti = getTypeInfo(r.type);
                      return (
                        <div key={r.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${r.isCompleted ? 'line-through opacity-40' : ti.color}`}>
                          {ti.icon} {r.title}
                        </div>
                      );
                    })}
                    {dayReminders.length > (dayEvents.length > 0 ? 1 : 2) && (
                      <div className="text-[9px] text-brand-400 px-1">+{dayReminders.length - (dayEvents.length > 0 ? 1 : 2)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-2 justify-end text-[10px] text-brand-500">
            {EVENT_TYPES.map(t => (
              <span key={t.value} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ backgroundColor: t.defaultColor + '20', color: t.defaultColor }}>
                <span>{t.icon}</span><span>{t.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-4">
          {/* Upcoming events */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-brand-900 text-right flex items-center gap-2 flex-row-reverse">
                <CalendarDays className="w-4 h-4 text-brand-500" />
                {isAr ? 'الإجازات والمواسم' : 'Holidays & Seasons'}
              </h3>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-brand-400 text-sm text-center py-4">{isAr ? 'لا توجد أحداث قادمة' : 'No upcoming events'}</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const ti = getEventTypeInfo(ev.type);
                  const c = ev.color || ti.defaultColor;
                  const start = parseISO(ev.eventDate);
                  const end = ev.endDate ? parseISO(ev.endDate) : null;
                  const diff = differenceInCalendarDays(start, now);
                  const dateLabel = isToday(start)
                    ? (isAr ? 'اليوم' : 'Today')
                    : isTomorrow(start)
                    ? (isAr ? 'غداً' : 'Tomorrow')
                    : diff > 0 && diff <= 14
                    ? (isAr ? `بعد ${diff} يوم` : `In ${diff}d`)
                    : format(start, 'dd MMM', { locale: isAr ? arSA : enUS });
                  return (
                    <div key={ev.id} className="flex items-start gap-2 flex-row-reverse p-2 rounded-lg border"
                      style={{ borderColor: c + '30', backgroundColor: c + '08' }}>
                      <span className="text-sm mt-0.5">{ti.icon}</span>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-semibold text-sm truncate" style={{ color: c }}>
                          {isAr ? ev.title : (ev.titleEn || ev.title)}
                        </p>
                        <p className="text-xs text-brand-500 mt-0.5">
                          {dateLabel}
                          {end && !isSameDay(start, end) && ` — ${format(end, 'dd MMM', { locale: isAr ? arSA : enUS })}`}
                          {ev.isRecurring && <span className="mx-1 opacity-60">· {isAr ? 'سنوي' : 'yearly'}</span>}
                        </p>
                      </div>
                      {canManageEvents && ev.source === 'manual' && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditEvent(ev)} className="p-1 text-brand-300 hover:text-brand-700">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteEvent(ev.id)} className="p-1 text-brand-300 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {canManageEvents && ev.source === 'nager' && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => deleteEvent(ev.id)} className="p-1 text-brand-300 hover:text-red-500" title={isAr ? 'حذف (سيعود عند المزامنة التالية)' : 'Delete (will reappear on next sync)'}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming reminders */}
          <div className="card p-5">
            <h3 className="font-bold text-brand-900 mb-3 text-right">{isAr ? 'التذكيرات القادمة' : 'Upcoming Reminders'}</h3>
            {upcomingReminders.length === 0 ? (
              <p className="text-brand-400 text-sm text-center py-4">{isAr ? 'لا توجد تذكيرات قادمة' : 'No upcoming'}</p>
            ) : (
              <div className="space-y-2">
                {upcomingReminders.map(r => {
                  const ti = getTypeInfo(r.type);
                  const d = parseISO(r.reminderDate);
                  const tomorrow = isTomorrow(d);
                  return (
                    <div key={r.id} className="flex items-start gap-2.5 flex-row-reverse p-2.5 rounded-lg hover:bg-brand-50/50">
                      <span className="text-sm mt-0.5">{ti.icon}</span>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-semibold text-sm text-brand-900 truncate">{r.title}</p>
                        <p className="text-xs text-brand-400 mt-0.5">
                          {tomorrow ? (isAr ? 'غداً' : 'Tomorrow') : format(d, 'dd MMM', { locale: isAr ? arSA : enUS })}
                          {r.reminderTime ? ` · ${r.reminderTime}` : ''}
                        </p>
                        {r.client && <p className="text-xs text-brand-400">{r.client.companyName}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => toggleComplete(r.id, false)} className="p-1 text-brand-300 hover:text-emerald-500">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteReminder(r.id)} className="p-1 text-brand-300 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="card p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-brand-50/50">
                <p className="text-lg font-bold text-brand-900">{reminders.filter(r => !r.isCompleted).length}</p>
                <p className="text-[10px] text-brand-400">{isAr ? 'تذكيرات' : 'Reminders'}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50/50">
                <p className="text-lg font-bold text-red-600">{events.length}</p>
                <p className="text-[10px] text-brand-400">{isAr ? 'أحداث' : 'Events'}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50/50">
                <p className="text-lg font-bold text-emerald-600">{reminders.filter(r => r.isCompleted).length}</p>
                <p className="text-[10px] text-brand-400">{isAr ? 'مكتمل' : 'Done'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Reminder Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isAr ? 'تذكير جديد' : 'New Reminder'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{isAr ? 'العنوان' : 'Title'} *</label>
            <input className="input" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'التاريخ' : 'Date'} *</label>
              <input className="input" type="date" required value={form.reminderDate}
                onChange={e => setForm(p => ({ ...p, reminderDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'الوقت' : 'Time'}</label>
              <input className="input" type="time" value={form.reminderTime}
                onChange={e => setForm(p => ({ ...p, reminderTime: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'النوع' : 'Type'}</label>
              <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'العميل (اختياري)' : 'Client'}</label>
              <select className="input" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                <option value="">{isAr ? 'بدون' : 'None'}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? '...' : (isAr ? 'إضافة التذكير' : 'Add Reminder')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Event Modal */}
      <Modal
        open={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        title={editingEvent ? (isAr ? 'تعديل حدث' : 'Edit Event') : (isAr ? 'إضافة حدث / إجازة' : 'Add Event / Holiday')}
        size="lg"
      >
        <form onSubmit={handleEventSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'الاسم بالعربية' : 'Title (AR)'} *</label>
              <input className="input" required value={eventForm.title}
                onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'الاسم بالإنجليزية' : 'Title (EN)'}</label>
              <input className="input" value={eventForm.titleEn}
                onChange={e => setEventForm(p => ({ ...p, titleEn: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'تاريخ البداية' : 'Start Date'} *</label>
              <input className="input" type="date" required value={eventForm.eventDate}
                onChange={e => setEventForm(p => ({ ...p, eventDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isAr ? 'تاريخ النهاية (اختياري)' : 'End Date (optional)'}</label>
              <input className="input" type="date" value={eventForm.endDate}
                onChange={e => setEventForm(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'النوع' : 'Type'}</label>
              <select className="input" value={eventForm.type}
                onChange={e => setEventForm(p => ({ ...p, type: e.target.value }))}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'اللون (اختياري)' : 'Color (optional)'}</label>
              <input className="input" type="color"
                value={eventForm.color || getEventTypeInfo(eventForm.type).defaultColor}
                onChange={e => setEventForm(p => ({ ...p, color: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-row-reverse justify-end">
            <input id="recurring" type="checkbox" checked={eventForm.isRecurring}
              onChange={e => setEventForm(p => ({ ...p, isRecurring: e.target.checked }))} />
            <label htmlFor="recurring" className="text-sm text-brand-700 cursor-pointer">
              {isAr ? 'يتكرر كل سنة (سنوي)' : 'Repeats every year'}
            </label>
          </div>
          <div>
            <label className="label">{isAr ? 'وصف / ملاحظات' : 'Description / Notes'}</label>
            <textarea className="input resize-none" rows={2} value={eventForm.description}
              onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary"
              onClick={() => { setShowEventModal(false); setEditingEvent(null); }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={savingEvent}>
              {savingEvent ? '...' : editingEvent ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إضافة الحدث' : 'Add Event')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
