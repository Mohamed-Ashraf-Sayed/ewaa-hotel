import { useEffect, useState } from 'react';
import { Plus, Percent } from 'lucide-react';
import { usersApi, hotelsApi } from '../services/api';
import { User, Hotel } from '../types';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ROLE_COLORS: Record<string, string> = {
  general_manager: 'bg-purple-100 text-purple-800',
  vice_gm: 'bg-indigo-100 text-indigo-800',
  sales_director: 'bg-blue-100 text-blue-800',
  sales_rep: 'bg-green-100 text-green-800',
  contract_officer: 'bg-amber-100 text-amber-800',
  reservations: 'bg-teal-100 text-teal-800',
  credit_manager: 'bg-rose-100 text-rose-800',
  credit_officer: 'bg-pink-100 text-pink-800',
};

export default function Users() {
  const { t, lang } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [commissionModal, setCommissionModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [saving, setSaving] = useState(false);
  const { hasRole, user: currentUser } = useAuth();

  const ROLES = [
    { value: 'general_manager', label: t('role_general_manager') },
    { value: 'vice_gm', label: t('role_vice_gm') },
    { value: 'sales_director', label: t('role_sales_director') },
    { value: 'sales_rep', label: t('role_sales_rep') },
    { value: 'contract_officer', label: t('role_contract_officer') },
    { value: 'reservations', label: t('role_reservations') },
    { value: 'credit_manager', label: t('role_credit_manager') },
    { value: 'credit_officer', label: t('role_credit_officer') },
  ];

  const emptyForm = { name: '', email: '', password: '', role: 'sales_rep', managerId: '', phone: '', hotelIds: [] as string[] };
  const [form, setForm] = useState(emptyForm);

  const loadUsers = () => {
    usersApi.getAll().then(r => setUsers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); hotelsApi.getAll().then(r => setHotels(r.data)); }, []);

  const openCreate = () => { setEditUser(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role, managerId: u.managerId?.toString() || '',
      phone: u.phone || '',
      hotelIds: u.hotels?.map(h => h.hotel.id.toString()) || []
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editUser) {
        await usersApi.update(editUser.id, { name: form.name, email: form.email, role: form.role, phone: form.phone, managerId: form.managerId || null, hotelIds: form.hotelIds });
      } else {
        await usersApi.create({ ...form, managerId: form.managerId || null });
      }
      setShowModal(false); loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || t('error_occurred'));
    } finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return; setSaving(true);
    try {
      await usersApi.resetPassword(resetModal.id, newPassword);
      setResetModal(null); setNewPassword('');
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const handleSetCommission = async () => {
    if (!commissionModal) return; setSaving(true);
    try {
      await usersApi.updateCommission(commissionModal.id, parseFloat(newCommission) || 0);
      setCommissionModal(null); setNewCommission('');
      loadUsers();
    } catch { alert(t('error_occurred')); } finally { setSaving(false); }
  };

  const toggleHotel = (id: string) => {
    setForm(p => ({
      ...p,
      hotelIds: p.hotelIds.includes(id) ? p.hotelIds.filter(h => h !== id) : [...p.hotelIds, id]
    }));
  };

  const managers = users.filter(u => ['general_manager', 'vice_gm', 'sales_director'].includes(u.role));
  const canAdmin = hasRole('general_manager', 'vice_gm');
  const isGM = hasRole('general_manager');
  const grouped = ROLES.map(r => ({ ...r, members: users.filter(u => u.role === r.value) })).filter(g => g.members.length > 0);
  const isAr = lang === 'ar';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className={isAr ? 'text-right' : 'text-left'}>
          <h1 className="text-2xl font-bold text-brand-900">{t('users_title')}</h1>
          <p className="text-brand-400 text-sm mt-0.5">{users.length} {lang === 'ar' ? 'عضو' : 'members'}</p>
        </div>
        {canAdmin && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> {t('user_add')}
          </button>
        )}
      </div>

      {grouped.map(group => (
        <div key={group.value}>
          <div className={`flex items-center gap-2 mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs text-brand-400">{group.members.length} {lang === 'ar' ? 'عضو' : 'members'}</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[group.value]}`}>
              {group.label}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {group.members.map(u => (
              <div key={u.id} className="card p-4 hover:border-brand-200 transition-colors">
                <div className={`flex items-start justify-between mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                    {u.name.charAt(0)}
                  </div>
                  {!u.isActive && (
                    <span className="text-xs bg-brand-100 text-brand-400 px-2 py-0.5 rounded-full">{t('inactive')}</span>
                  )}
                </div>
                <div className={isAr ? 'text-right' : 'text-left'}>
                  <p className="font-bold text-brand-900 text-sm">{u.name}</p>
                  <p className="text-xs text-brand-400 mt-0.5 dir-ltr">{u.email}</p>
                  {u.phone && <p className="text-xs text-brand-400 mt-0.5">{u.phone}</p>}
                  {u.manager && (
                    <p className="text-xs text-brand-400 mt-1">
                      {lang === 'ar' ? 'يرفع لـ: ' : 'Reports to: '}{u.manager.name}
                    </p>
                  )}
                  {/* Commission Rate Badge */}
                  {u.commissionRate !== undefined && u.commissionRate !== null && u.commissionRate > 0 && (
                    <div className={`flex items-center gap-1 mt-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                        <Percent className="w-3 h-3" />
                        {t('commission_rate')}: {u.commissionRate}%
                      </span>
                    </div>
                  )}
                  <div className={`flex items-center gap-3 mt-3 text-xs text-brand-400 ${isAr ? 'flex-row-reverse' : ''}`}>
                    {u._count && <>
                      <span title={t('nav_clients')}>🏢 {u._count.assignedClients}</span>
                      <span title={t('nav_contracts')}>📄 {u._count.contracts}</span>
                    </>}
                  </div>
                  {u.hotels?.length ? (
                    <div className={`mt-2 flex flex-wrap gap-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                      {u.hotels.slice(0, 2).map(h => (
                        <span key={h.hotel.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full truncate max-w-24">
                          {isAr ? h.hotel.name.split(' ')[0] : h.hotel.name.split(' ')[0]}
                        </span>
                      ))}
                      {u.hotels.length > 2 && <span className="text-xs text-brand-400">+{u.hotels.length - 2}</span>}
                    </div>
                  ) : null}

                  {canAdmin && (
                    <div className={`flex gap-2 mt-3 pt-3 border-t border-brand-100 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
                      <button onClick={() => openEdit(u)} className="text-xs text-brand-600 hover:underline">{t('edit')}</button>
                      <button onClick={() => { setResetModal(u); setNewPassword(''); }} className="text-xs text-brand-400 hover:underline">
                        {t('user_reset_password')}
                      </button>
                      {isGM && ['sales_rep', 'sales_director'].includes(u.role) && (
                        <button
                          onClick={() => { setCommissionModal(u); setNewCommission(u.commissionRate?.toString() || '0'); }}
                          className="text-xs text-green-600 hover:underline flex items-center gap-1"
                        >
                          <Percent className="w-3 h-3" />
                          {t('user_set_commission')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editUser ? t('user_add') : t('user_add')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('user_name')} *</label>
              <input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('user_email')} *</label>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} dir="ltr" />
            </div>
            {!editUser && (
              <div>
                <label className="label">{t('user_password')} *</label>
                <input className="input" type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} dir="ltr" />
              </div>
            )}
            <div>
              <label className="label">{t('user_phone')}</label>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className="label">{t('user_role')} *</label>
              <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('user_manager')}</label>
              <select className="input" value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}>
                <option value="">{lang === 'ar' ? 'لا يوجد' : 'None'}</option>
                {managers.filter(m => m.id !== editUser?.id).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({ROLES.find(r => r.value === m.role)?.label})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('user_hotels')}</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-brand-200 rounded-lg p-2">
              {hotels.map(h => (
                <label key={h.id} className={`flex items-center gap-2 p-2 rounded-lg border border-brand-100 hover:bg-brand-50 cursor-pointer ${isAr ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs truncate">{isAr ? h.name : (h.nameEn || h.name)}</span>
                  <input type="checkbox" checked={form.hotelIds.includes(h.id.toString())} onChange={() => toggleHotel(h.id.toString())} className="rounded text-brand-600 flex-shrink-0" />
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t('cancel')}</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? t('saving') : editUser ? t('save') : t('user_add')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetModal} onClose={() => setResetModal(null)}
        title={`${t('user_reset_password')} — ${resetModal?.name}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</label>
            <input className="input" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={lang === 'ar' ? 'أدخل كلمة مرور جديدة' : 'Enter new password'} dir="ltr" />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setResetModal(null)}>{t('cancel')}</button>
            <button onClick={handleResetPassword} className="btn-primary flex-1 justify-center" disabled={saving || !newPassword}>
              {saving ? t('saving') : t('confirm')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Commission Rate Modal */}
      <Modal open={!!commissionModal} onClose={() => setCommissionModal(null)}
        title={`${t('user_set_commission')} — ${commissionModal?.name}`} size="sm">
        <div className="space-y-4">
          <div className={`p-3 rounded-lg bg-brand-50 text-sm text-brand-700 ${isAr ? 'text-right' : ''}`}>
            {lang === 'ar'
              ? 'تُحسب العمولة على المبالغ المحصّلة بالفعل فقط'
              : 'Commission is calculated on collected amounts only'}
          </div>
          <div>
            <label className="label">{t('user_commission')} (0 – 100)</label>
            <div className="relative">
              <input
                className="input pr-8"
                type="number" min="0" max="100" step="0.5"
                value={newCommission}
                onChange={e => setNewCommission(e.target.value)}
              />
              <Percent className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-brand-400" />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setCommissionModal(null)}>{t('cancel')}</button>
            <button onClick={handleSetCommission} className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
