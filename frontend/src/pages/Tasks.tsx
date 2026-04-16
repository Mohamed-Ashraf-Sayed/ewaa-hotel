import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Clock, AlertTriangle, Circle, Building2, FileText, Trash2 } from 'lucide-react';
import { tasksApi, usersApi, clientsApi } from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO, isPast } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface Task {
  id: number; title: string; description?: string; priority: string; status: string;
  dueDate?: string; completedAt?: string; createdAt: string;
  assignee: { id: number; name: string };
  createdBy: { id: number; name: string };
  client?: { id: number; companyName: string };
  contract?: { id: number; contractRef: string };
}

export default function Tasks() {
  const { t, lang } = useLanguage();
  const { hasRole, user } = useAuth();
  const isAr = lang === 'ar';
  const canManage = hasRole('sales_director', 'general_manager', 'vice_gm');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = { title: '', description: '', assigneeId: '', clientId: '', priority: 'normal', dueDate: '' };
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

  const updateStatus = async (id: number, status: string) => {
    await tasksApi.update(id, { status });
    load();
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
            return (
              <div key={task.id} className={`card p-4 ${overdue ? 'border-l-4 border-l-red-500' : task.priority === 'urgent' ? 'border-l-4 border-l-amber-500' : ''}`}>
                <div className={`flex items-start justify-between gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-start gap-3 flex-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <button onClick={() => updateStatus(task.id, task.status === 'completed' ? 'new' : task.status === 'new' ? 'in_progress' : 'completed')}
                      className="mt-0.5 hover:scale-110 transition-transform">
                      {statusIcon(task.status)}
                    </button>
                    <div className={`flex-1 min-w-0 ${isAr ? 'text-right' : ''}`}>
                      <p className={`font-bold text-brand-900 ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}>{task.title}</p>
                      {task.description && <p className="text-xs text-brand-400 mt-0.5">{task.description}</p>}
                      <div className={`flex items-center gap-3 mt-2 text-xs text-brand-400 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {task.status !== 'completed' && (
                      <select className="text-xs border border-brand-200 rounded-lg px-2 py-1 text-brand-600 bg-white"
                        value={task.status} onChange={e => updateStatus(task.id, e.target.value)}>
                        <option value="new">{statusLabel.new}</option>
                        <option value="in_progress">{statusLabel.in_progress}</option>
                        <option value="completed">{statusLabel.completed}</option>
                      </select>
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
              <label className="label">{isAr ? 'العميل (اختياري)' : 'Client (optional)'}</label>
              <select className="input" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
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
    </div>
  );
}
