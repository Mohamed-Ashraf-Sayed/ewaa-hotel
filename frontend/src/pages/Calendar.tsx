import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Phone, MapPin, Users, Bell, CheckCircle, Trash2, Building2 } from 'lucide-react';
import { remindersApi, clientsApi } from '../services/api';
import Modal from '../components/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO, isToday, isTomorrow, isPast, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface Reminder {
  id: number; title: string; description?: string; reminderDate: string;
  reminderTime?: string; type: string; isCompleted: boolean;
  client?: { id: number; companyName: string };
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

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const TYPES = isAr ? TYPES_AR : TYPES_EN;
  const DAYS = isAr ? DAYS_AR : DAYS_EN;
  const MONTHS = isAr ? MONTHS_AR : MONTHS_EN;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { title: '', description: '', reminderDate: '', reminderTime: '', type: 'general', clientId: '' };
  const [form, setForm] = useState(emptyForm);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const load = () => {
    setLoading(true);
    remindersApi.getAll({ month, year }).then(r => setReminders(r.data)).finally(() => setLoading(false));
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

  const prevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month, 1));

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart); // 0=Sun

  const getTypeInfo = (type: string) => TYPES.find(t => t.value === type) || TYPES[4];

  // Today's and upcoming reminders
  const todayReminders = reminders.filter(r => isToday(parseISO(r.reminderDate)) && !r.isCompleted);
  const upcomingReminders = reminders.filter(r => {
    const d = parseISO(r.reminderDate);
    return !isPast(d) && !isToday(d) && !r.isCompleted;
  }).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'التقويم والتذكيرات' : 'Calendar & Reminders'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'جدّول مواعيدك ومتابعاتك' : 'Schedule your appointments'}</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ ...emptyForm, reminderDate: format(new Date(), 'yyyy-MM-dd') }); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> {isAr ? 'تذكير جديد' : 'New Reminder'}
        </button>
      </div>

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
              <div key={`empty-${i}`} className="h-20" />
            ))}
            {days.map(day => {
              const dayReminders = reminders.filter(r => isSameDay(parseISO(r.reminderDate), day));
              const today = isToday(day);
              return (
                <button key={day.toISOString()} onClick={() => openAddForDate(day)}
                  className={`h-20 rounded-lg border p-1.5 text-right hover:bg-brand-50 transition-colors relative
                    ${today ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600' : 'border-brand-100'}
                    ${isPast(day) && !today ? 'opacity-50' : ''}`}>
                  <span className={`text-xs font-bold ${today ? 'text-brand-700' : 'text-brand-900'}`}>
                    {day.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {dayReminders.slice(0, 2).map(r => {
                      const ti = getTypeInfo(r.type);
                      return (
                        <div key={r.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${r.isCompleted ? 'line-through opacity-40' : ti.color}`}>
                          {ti.icon} {r.title}
                        </div>
                      );
                    })}
                    {dayReminders.length > 2 && (
                      <div className="text-[9px] text-brand-400 px-1">+{dayReminders.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-4">
          {/* Upcoming */}
          <div className="card p-5">
            <h3 className="font-bold text-brand-900 mb-3 text-right">{isAr ? 'القادم' : 'Upcoming'}</h3>
            {upcomingReminders.length === 0 ? (
              <p className="text-brand-400 text-sm text-center py-6">{isAr ? 'لا توجد تذكيرات قادمة' : 'No upcoming'}</p>
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
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-brand-50/50">
                <p className="text-xl font-bold text-brand-900">{reminders.filter(r => !r.isCompleted).length}</p>
                <p className="text-xs text-brand-400">{isAr ? 'نشط' : 'Active'}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/50">
                <p className="text-xl font-bold text-emerald-600">{reminders.filter(r => r.isCompleted).length}</p>
                <p className="text-xs text-brand-400">{isAr ? 'مكتمل' : 'Done'}</p>
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
    </div>
  );
}
