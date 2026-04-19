import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Clock, Circle, Building2, Trash2, Lock, MapPin, Phone, Users as UsersIcon } from 'lucide-react';
import { tasksApi, usersApi, clientsApi } from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO, isPast } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface Task {
  id: number; title: string; description?: string; priority: string; status: string;
  taskType: string; completionNotes?: string; generatedVisitId?: number;
  dueDate?: string; completedAt?: string; createdAt: string;
  assignee: { id: number; name: string };
  createdBy: { id: number; name: string };
  client?: { id: number; companyName: string };
  contract?: { id: number; contractRef: string };
}

const TASK_TYPES_AR: Record<string, { label: string; icon: string }> = {
  general: { label: 'عام', icon: '📌' },
  visit: { label: 'زيارة', icon: '🤝' },
  call: { label: 'مكالمة', icon: '📞' },
  meeting: { label: 'اجتماع', icon: '👥' },
  follow_up: { label: 'متابعة', icon: '🔄' },
};
const TASK_TYPES_EN: Record<string, { label: string; icon: string }> = {
  general: { label: 'General', icon: '📌' },
  visit: { label: 'Visit', icon: '🤝' },
  call: { label: 'Call', icon: '📞' },
  meeting: { label: 'Meeting', icon: '👥' },
  follow_up: { label: 'Follow-up', icon: '🔄' },
};

export default function Tasks() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const isAr = lang === 'ar';
  const canManage = hasRole('sales_director', 'general_manager', 'vice_gm');
  const isAdmin = hasRole('general_manager', 'vice_gm');
  const TASK_TYPES = isAr ? TASK_TYPES_AR : TASK_TYPES_EN;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [completeModal, setCompleteModal] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const emptyForm = { title: '', description: '', taskType: 'general', assigneeId: '', clientId: '', priority: 'normal', dueDate: '' };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    tasksApi.getAll(filter !== 'all' ? { status: filter } : {}).then(r => setTasks(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    if (canManage) {
      usersApi.getAll().then(r => setUsers(r.data.filter((u: any) => ['sales_rep', 'sales_director'].includes(u.role))));
      clientsApi.getAll().then(r => setClients(r.data));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await tasksApi.create({ ...form, assigneeId: parseInt(form.assigneeId), clientId: form.clientId ? parseInt(form.clientId) : null });
      setShowModal(false); setForm(emptyForm); load();
    } catch { alert(isAr ? 'حدث خطأ' : 'Error'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (task: Task, status: string) => {
    if (task.status === 'completed' && !isAdmin) {
      alert(isAr ? 'لا يمكن تعديل مهمة مكتملة' : 'Cannot modify a completed task');
      return;
    }
    // If completing, show modal to add notes
    if (status === 'completed' && task.status !== 'completed') {
      setCompleteModal(task);
      setCompletionNotes('');
      return;
    }
    try {
      await tasksApi.update(task.id, { status });
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const handleComplete = async () => {
    if (!completeModal) return;
    setSaving(true);
    try {
      await tasksApi.update(completeModal.id, { status: 'completed', completionNotes });
      setCompleteModal(null); setCompletionNotes(''); load();
    } catch (err: any) {
      alert(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    } finally { setSaving(false); }
  };

  const deleteTask = async (id: number) => {
    if (!confirm(isAr ? 'حذف المهمة؟' : 'Delete task?')) return;
    await tasksApi.delete(id); load();
  };

  const statusIcon = (s: string) => s === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-500" />
    : s === 'in_progress' ? <Clock className="w-4 h-4 text-amber-500" />
    : <Circle className="w-4 h-4 text-brand-300" />;

  const statusLabel: Record<string, string> = { new: isAr ? 'جديد' : 'New', in_progress: isAr ? 'قيد التنفيذ' : 'In Progress', completed: isAr ? 'مكتمل' : 'Completed' };
  const priorityLabel: Record<string, string> = { urgent: isAr ? 'عاجل' : 'Urgent', normal: isAr ? 'عادي' : 'Normal' };

  const counts = { all: tasks.length, new: tasks.filter(t => t.status === 'new').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'المهام' : 'Tasks'}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{isAr ? 'إدارة وتوزيع مهام الفريق' : 'Manage team tasks'}</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>
            <Plus className="w-4 h-4" /> {isAr ? 'مهمة جديدة' : 'New Task'}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className={`flex gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
        {(['all', 'new', 'in_progress', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === f ? 'bg-brand-800 text-white' : 'bg-white text-brand-500 border border-brand-200 hover:bg-brand-50'}`}>
            {f === 'all' ? (isAr ? 'الكل' : 'All') : statusLabel[f]}
            <span className="mr-1.5 text-xs opacity-70">({(counts as any)[f]})</span>
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="card py-12 text-center text-brand-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : tasks.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle className="w-12 h-12 text-brand-200 mx-auto mb-3" />
          <p className="text-brand-400 font-semibold">{isAr ? 'لا توجد مهام' : 'No tasks'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const overdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== 'completed';
            const isLocked = task.status === 'completed' && !isAdmin;
            const taskTypeInfo = TASK_TYPES[task.taskType] || TASK_TYPES.general;
            return (
              <div key={task.id} className={`card p-4 ${task.status === 'completed' ? 'bg-emerald-50/30' : overdue ? 'border-l-4 border-l-red-500' : task.priority === 'urgent' ? 'border-l-4 border-l-amber-500' : ''}`}>
                <div className={`flex items-start justify-between gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-start gap-3 flex-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <button onClick={() => updateStatus(task, task.status === 'new' ? 'in_progress' : 'completed')}
                      disabled={isLocked}
                      className={`mt-0.5 transition-transform ${isLocked ? 'cursor-not-allowed opacity-60' : 'hover:scale-110'}`}>
                      {statusIcon(task.status)}
                    </button>
                    <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                        <span className="text-base">{taskTypeInfo.icon}</span>
                        <p className={`font-bold text-brand-900 ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}>{task.title}</p>
                        {task.status === 'completed' && <Lock className="w-3 h-3 text-emerald-500" />}
                      </div>
                      {task.description && <p className="text-xs text-brand-400 mt-0.5">{task.description}</p>}
                      {task.completionNotes && (
                        <div className={`mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs ${isAr ? 'text-right' : ''}`}>
                          <span className="font-semibold text-emerald-700">{isAr ? '✓ ملاحظات الإنجاز: ' : '✓ Completion notes: '}</span>
                          <span className="text-emerald-600">{task.completionNotes}</span>
                        </div>
                      )}
                      <div className={`flex items-center gap-2 mt-2 text-xs text-brand-400 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                        <span className={`px-2 py-0.5 rounded-md font-semibold bg-brand-50 text-brand-600`}>{taskTypeInfo.label}</span>
                        <span className={`px-2 py-0.5 rounded-md font-semibold ${task.priority === 'urgent' ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-500'}`}>
                          {priorityLabel[task.priority]}
                        </span>
                        <span>👤 {task.assignee.name}</span>
                        {task.client && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{task.client.companyName}</span>}
                        {task.dueDate && (
                          <span className={overdue ? 'text-red-600 font-bold' : ''}>
                            📅 {format(parseISO(task.dueDate), 'dd MMM', { locale: isAr ? arSA : enUS })}
                            {overdue && (isAr ? ' (متأخر)' : ' (overdue)')}
                          </span>
                        )}
                        {task.generatedVisitId && (
                          <span className="text-emerald-600 font-semibold">{isAr ? '✓ تم تسجيل زيارة' : '✓ Visit logged'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isLocked && (
                      <select className="text-xs border border-brand-200 rounded-lg px-2 py-1 text-brand-600 bg-white"
                        value={task.status} onChange={e => updateStatus(task, e.target.value)}>
                        <option value="new">{statusLabel.new}</option>
                        <option value="in_progress">{statusLabel.in_progress}</option>
                        <option value="completed">{statusLabel.completed}</option>
                      </select>
                    )}
                    {isLocked && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                        <Lock className="w-3 h-3" /> {isAr ? 'مقفلة' : 'Locked'}
                      </span>
                    )}
                    {canManage && (
                      <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-brand-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isAr ? 'مهمة جديدة' : 'New Task'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{isAr ? 'عنوان المهمة' : 'Task Title'} *</label>
            <input className="input" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">{isAr ? 'الوصف' : 'Description'}</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">{isAr ? 'نوع المهمة' : 'Task Type'} *</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(TASK_TYPES).map(([k, v]) => (
                <button type="button" key={k} onClick={() => setForm(p => ({ ...p, taskType: k }))}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${form.taskType === k ? 'border-brand-600 bg-brand-50' : 'border-brand-100 hover:border-brand-300'}`}>
                  <div className="text-xl">{v.icon}</div>
                  <div className="text-[11px] font-semibold mt-1 text-brand-700">{v.label}</div>
                </button>
              ))}
            </div>
            {form.taskType !== 'general' && (
              <p className="text-[11px] text-brand-400 mt-2">
                {isAr ? '💡 عند إنجاز المهمة سيتم تسجيلها تلقائياً في زيارات العميل' : '💡 When completed, this will auto-log a visit for the client'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isAr ? 'المسؤول' : 'Assignee'} *</label>
              <select className="input" required value={form.assigneeId} onChange={e => setForm(p => ({ ...p, assigneeId: e.target.value }))}>
                <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'الأولوية' : 'Priority'}</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="normal">{isAr ? 'عادي' : 'Normal'}</option>
                <option value="urgent">{isAr ? 'عاجل' : 'Urgent'}</option>
              </select>
            </div>
            <div>
              <label className="label">
                {isAr ? 'العميل' : 'Client'}
                {form.taskType !== 'general' && ' *'}
              </label>
              <select className="input" required={form.taskType !== 'general'} value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                <option value="">{isAr ? 'بدون' : 'None'}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
              <input className="input" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إنشاء المهمة' : 'Create Task')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Task Modal */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title={isAr ? 'إنهاء المهمة' : 'Complete Task'}>
        {completeModal && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg bg-brand-50 ${isAr ? 'text-right' : ''}`}>
              <p className="font-bold text-brand-900">{completeModal.title}</p>
              {completeModal.client && <p className="text-xs text-brand-500 mt-1">{completeModal.client.companyName}</p>}
            </div>
            {completeModal.taskType !== 'general' && completeModal.client && (
              <div className={`p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs ${isAr ? 'text-right' : ''}`}>
                <p className="text-emerald-700">
                  {isAr ? '✓ سيتم تسجيل هذه المهمة تلقائياً كزيارة في ملف العميل' : '✓ This task will be auto-logged as a visit in the client profile'}
                </p>
              </div>
            )}
            <div>
              <label className="label">{isAr ? 'ملاحظات الإنجاز / النتيجة' : 'Completion Notes / Outcome'}</label>
              <textarea className="input resize-none" rows={4} value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder={isAr ? 'اكتب نتيجة المهمة وأي ملاحظات...' : 'Write task outcome and notes...'} />
            </div>
            <div className={`p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] ${isAr ? 'text-right' : ''}`}>
              <p className="text-amber-700 font-semibold">
                ⚠️ {isAr ? 'تنبيه: بعد إنهاء المهمة لن تستطيع تعديلها مرة أخرى' : 'Warning: Once completed, you cannot modify this task again'}
              </p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setCompleteModal(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button className="btn-primary flex-1 justify-center bg-emerald-600 hover:bg-emerald-700"
                onClick={handleComplete} disabled={saving}>
                {saving ? '...' : `✓ ${isAr ? 'تأكيد الإنهاء' : 'Confirm Completion'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
