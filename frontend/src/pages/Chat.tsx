import { useEffect, useState, useRef } from 'react';
import { Send, Search, Users, MessageCircle, Megaphone, X } from 'lucide-react';
import { messagesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

interface Contact {
  id: number; name: string; role: string; email: string;
  lastMessage?: { content: string; createdAt: string; fromUserId: number };
  unreadCount: number;
}

interface Message {
  id: number; fromUserId: number; toUserId: number;
  content: string; isRead: boolean; createdAt: string;
}

const ROLE_LABEL: Record<string, { ar: string; en: string }> = {
  admin: { ar: 'مدير النظام', en: 'IT Admin' },
  general_manager: { ar: 'مدير عام', en: 'GM' },
  vice_gm: { ar: 'نائب المدير العام', en: 'Vice GM' },
  sales_director: { ar: 'مدير مبيعات', en: 'Sales Director' },
  assistant_sales: { ar: 'مساعد مدير المبيعات', en: 'Assistant' },
  sales_rep: { ar: 'مندوب مبيعات', en: 'Sales Rep' },
  contract_officer: { ar: 'مسئول العقود', en: 'Contracts' },
  reservations: { ar: 'حجوزات', en: 'Reservations' },
  credit_manager: { ar: 'مدير الائتمان', en: 'Credit Manager' },
  credit_officer: { ar: 'موظف ائتمان', en: 'Credit Officer' },
};

export default function Chat() {
  const { user, hasRole } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const canBroadcast = hasRole('sales_director', 'general_manager', 'vice_gm', 'admin');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadContacts = () => {
    messagesApi.getContacts().then(r => setContacts(r.data));
  };

  const loadMessages = (contactId: number) => {
    messagesApi.getConversation(contactId).then(r => {
      setMessages(r.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  };

  useEffect(() => { loadContacts(); }, []);

  // Poll for new messages every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadContacts();
      if (activeContact) loadMessages(activeContact.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeContact]);

  const openConversation = (c: Contact) => {
    setActiveContact(c);
    loadMessages(c.id);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !text.trim()) return;
    setSending(true);
    try {
      await messagesApi.send(activeContact.id, text);
      setText('');
      loadMessages(activeContact.id);
      loadContacts();
    } finally { setSending(false); }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setSending(true);
    try {
      const res = await messagesApi.broadcast(broadcastText);
      alert(isAr ? `تم إرسال الرسالة لـ ${res.data.count} شخص` : `Sent to ${res.data.count} people`);
      setShowBroadcast(false);
      setBroadcastText('');
      loadContacts();
    } catch { alert(isAr ? 'فشل الإرسال' : 'Failed'); }
    finally { setSending(false); }
  };

  const formatMsgTime = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return format(d, 'hh:mm a', { locale });
    if (isYesterday(d)) return isAr ? 'أمس' : 'Yesterday';
    return format(d, 'dd MMM', { locale });
  };

  const filteredContacts = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className={isAr ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-brand-900">{isAr ? 'المحادثات' : 'Chat'}</h1>
          <p className="text-brand-400 text-sm">{isAr ? 'تواصل مع فريقك مباشرة' : 'Talk with your team'}</p>
        </div>
        {canBroadcast && (
          <button onClick={() => setShowBroadcast(true)}
            className="btn-primary text-sm">
            <Megaphone className="w-4 h-4" /> {isAr ? 'إعلان عام' : 'Broadcast'}
          </button>
        )}
      </div>

      {/* Chat Layout */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Contacts Sidebar */}
        <div className={`card w-80 flex flex-col ${activeContact && 'hidden md:flex'}`}>
          <div className="p-3 border-b border-brand-100">
            <div className="relative">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-brand-400`} />
              <input className={`input ${isAr ? 'pr-9' : 'pl-9'}`}
                placeholder={isAr ? 'بحث...' : 'Search...'}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12 text-brand-400 text-sm">
                <Users className="w-10 h-10 mx-auto mb-2 text-brand-200" />
                {isAr ? 'لا يوجد جهات اتصال' : 'No contacts'}
              </div>
            ) : (
              filteredContacts.map(c => (
                <button key={c.id} onClick={() => openConversation(c)}
                  className={`w-full text-right p-3 hover:bg-brand-50 transition-colors border-b border-brand-50 ${
                    activeContact?.id === c.id ? 'bg-brand-50' : ''
                  } ${isAr ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-start gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-white font-bold text-sm">
                        {c.name.charAt(0)}
                      </div>
                      {c.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {c.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center justify-between gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <p className="font-bold text-brand-900 text-sm truncate">{c.name}</p>
                        {c.lastMessage && (
                          <span className="text-[10px] text-brand-400 flex-shrink-0">
                            {formatMsgTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-brand-400 mt-0.5">
                        {ROLE_LABEL[c.role]?.[isAr ? 'ar' : 'en'] || c.role}
                      </p>
                      {c.lastMessage && (
                        <p className={`text-xs mt-1 truncate ${c.unreadCount > 0 ? 'text-brand-700 font-semibold' : 'text-brand-400'}`}>
                          {c.lastMessage.fromUserId === user?.id ? (isAr ? 'أنت: ' : 'You: ') : ''}
                          {c.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className={`card flex-1 flex flex-col ${!activeContact && 'hidden md:flex'}`}>
          {!activeContact ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <MessageCircle className="w-16 h-16 mx-auto text-brand-200 mb-3" />
                <p className="text-brand-400 font-semibold">{isAr ? 'اختر محادثة للبدء' : 'Select a conversation to start'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={`p-3 border-b border-brand-100 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <button className="md:hidden p-1.5 rounded-lg hover:bg-brand-50" onClick={() => setActiveContact(null)}>
                  <X className="w-4 h-4 text-brand-500" />
                </button>
                <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-white font-bold text-sm">
                  {activeContact.name.charAt(0)}
                </div>
                <div className={`flex-1 ${isAr ? 'text-right' : ''}`}>
                  <p className="font-bold text-brand-900 text-sm">{activeContact.name}</p>
                  <p className="text-[11px] text-brand-400">{ROLE_LABEL[activeContact.role]?.[isAr ? 'ar' : 'en']}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-brand-50/30">
                {messages.length === 0 ? (
                  <div className="text-center text-brand-400 text-sm py-12">
                    {isAr ? 'لا توجد رسائل بعد - ابدأ المحادثة' : 'No messages yet - start the conversation'}
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.fromUserId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm ${
                          isMe ? 'bg-brand-700 text-white' : 'bg-white text-brand-900 border border-brand-100'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-brand-200' : 'text-brand-400'} text-left`} dir="ltr">
                            {formatMsgTime(msg.createdAt)}
                            {isMe && msg.isRead && ' ✓✓'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className={`p-3 border-t border-brand-100 flex gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                <input className="input flex-1"
                  placeholder={isAr ? 'اكتب رسالتك...' : 'Type your message...'}
                  value={text} onChange={e => setText(e.target.value)} />
                <button type="submit" disabled={sending || !text.trim()}
                  className="btn-primary px-4">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm" onClick={() => setShowBroadcast(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-xl shadow-elevated p-6">
            <div className={`flex items-center gap-2 mb-4 ${isAr ? 'flex-row-reverse' : ''}`}>
              <Megaphone className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-bold text-brand-900">{isAr ? 'إعلان عام للفريق' : 'Team Broadcast'}</h2>
            </div>
            <p className="text-xs text-brand-500 mb-3">
              {isAr ? '⚠️ سيتم إرسال هذه الرسالة لكل أعضاء فريقك' : '⚠️ This message will be sent to your entire team'}
            </p>
            <textarea className="input resize-none" rows={4}
              placeholder={isAr ? 'اكتب الرسالة...' : 'Write your message...'}
              value={broadcastText} onChange={e => setBroadcastText(e.target.value)} autoFocus />
            <div className="flex gap-3 mt-4">
              <button className="btn-secondary" onClick={() => setShowBroadcast(false)}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button className="btn-primary flex-1 justify-center" onClick={sendBroadcast} disabled={sending || !broadcastText.trim()}>
                <Megaphone className="w-4 h-4" /> {sending ? '...' : (isAr ? 'إرسال للجميع' : 'Send to All')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
