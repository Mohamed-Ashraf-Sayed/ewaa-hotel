import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X, Loader2, MessageCircle } from 'lucide-react';
import { aiApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const STORAGE_KEY = 'ai_assistant_history_v1';

export default function AiAssistant() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30))); }, [history]);
  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [open, history.length]);

  // Don't show on login/forgot pages
  if (!user) return null;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || sending) return;
    const userMsg: Message = { role: 'user', content: q, timestamp: Date.now() };
    const replyTs = Date.now() + 1;
    setHistory(h => [...h, userMsg, { role: 'assistant', content: '', timestamp: replyTs }]);
    setInput('');
    setSending(true);
    try {
      const token = localStorage.getItem('token') || '';
      const histPayload = history.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const resp = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: q, history: histPayload }),
      });
      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.message || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Parse SSE events: each event ends with \n\n
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const ev of events) {
          const lines = ev.split('\n');
          let event = 'message', dataStr = '';
          for (const ln of lines) {
            if (ln.startsWith('event:')) event = ln.slice(6).trim();
            else if (ln.startsWith('data:')) dataStr += ln.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (event === 'chunk' && data.text) {
              setHistory(h => h.map(m => m.timestamp === replyTs ? { ...m, content: m.content + data.text } : m));
            } else if (event === 'error') {
              setHistory(h => h.map(m => m.timestamp === replyTs ? { ...m, content: `⚠️ ${data.message}` } : m));
            }
          } catch (_) { /* ignore malformed chunk */ }
        }
      }
    } catch (err: any) {
      const msg = err?.message || (isAr ? 'فشل الاتصال بالمساعد' : 'Assistant unavailable');
      setHistory(h => h.map(m => m.timestamp === replyTs ? { ...m, content: `⚠️ ${msg}` } : m));
    } finally {
      setSending(false);
    }
  };

  const clear = () => {
    if (!confirm(isAr ? 'مسح المحادثة؟' : 'Clear chat?')) return;
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const suggestions = isAr
    ? ['كم عميل عندي؟', 'ايه العقود اللي هتنتهي خلال أسبوعين؟', 'الدفعات اللي بانتظار الموافقة', 'العملاء اللي ما اتواصلتش معاهم 30 يوم']
    : ['How many clients do I have?', 'Contracts expiring in 14 days?', 'Pending payments awaiting approval', 'Clients not contacted in 30 days'];

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 end-5 z-50 w-14 h-14 rounded-full shadow-lg bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 hover:scale-105 transition-transform flex items-center justify-center text-white"
          aria-label={isAr ? 'مساعد الذكاء الاصطناعي' : 'AI Assistant'}
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 end-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-2rem)] rounded-2xl shadow-2xl bg-white border border-brand-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-brand-800 to-brand-900 text-white flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <div>
                <p className="font-bold text-sm">{isAr ? 'مساعد إيواء الذكي' : 'Ewaa AI Assistant'}</p>
                <p className="text-[10px] text-white/70">{isAr ? 'اسألني أي حاجة عن بياناتك' : 'Ask anything about your data'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button onClick={clear} className="text-[10px] text-white/60 hover:text-white px-2 py-1 rounded">
                  {isAr ? 'مسح' : 'Clear'}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-brand-50/30">
            {history.length === 0 && (
              <div className="space-y-3 mt-4">
                <div className={`text-center ${isAr ? 'text-right' : ''}`}>
                  <MessageCircle className="w-10 h-10 text-brand-300 mx-auto mb-2" />
                  <p className="text-sm text-brand-600 font-semibold">{isAr ? 'مرحباً!' : 'Hi there!'}</p>
                  <p className="text-xs text-brand-400 mt-1">{isAr ? 'اسألني عن العملاء، العقود، الدفعات، الزيارات، أو الحجوزات' : 'Ask me about clients, contracts, payments, visits, or bookings'}</p>
                </div>
                <div className="space-y-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setInput(s); setTimeout(() => send(), 0); }}
                      className={`w-full text-xs px-3 py-2 rounded-lg bg-white border border-brand-100 hover:border-brand-300 hover:bg-brand-50 text-brand-600 ${isAr ? 'text-right' : 'text-left'}`}
                    >
                      💡 {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-brand-700 text-white rounded-br-sm'
                    : 'bg-white border border-brand-100 text-brand-800 rounded-bl-sm'
                } ${isAr ? 'text-right' : 'text-left'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && history.length > 0 && history[history.length - 1].role === 'assistant' && !history[history.length - 1].content && (
              <div className="flex justify-start">
                <div className="bg-white border border-brand-100 rounded-2xl rounded-bl-sm px-3 py-2 inline-flex items-center gap-2 text-xs text-brand-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {isAr ? 'بفكر...' : 'Thinking...'}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} className="p-2.5 bg-white border-t border-brand-100 flex gap-2">
            <input
              className="input text-sm"
              placeholder={isAr ? 'اكتب سؤالك...' : 'Ask me anything...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={sending}
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-3 rounded-lg bg-brand-700 hover:bg-brand-800 text-white disabled:opacity-50 flex items-center justify-center"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
