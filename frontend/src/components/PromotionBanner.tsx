import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { promotionsApi } from '../services/api';
import { Promotion } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';

const DISMISS_KEY_PREFIX = 'promo_dismissed_';
const ROTATE_MS = 7000;   // auto-rotate every 7 seconds when there are multiple

// Persist dismissed promo IDs in localStorage so a user-closed banner
// stays closed for the rest of that promo's run. Keyed by id+endsAt so
// re-running an old promo with new dates won't be silenced.
const dismissKey = (p: Promotion) => `${DISMISS_KEY_PREFIX}${p.id}_${p.endsAt}`;

const isDismissed = (p: Promotion) => {
  try { return localStorage.getItem(dismissKey(p)) === '1'; } catch { return false; }
};

const markDismissed = (p: Promotion) => {
  try { localStorage.setItem(dismissKey(p), '1'); } catch {}
};

export default function PromotionBanner() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const locale = isAr ? arSA : enUS;
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    promotionsApi.active()
      .then(r => {
        if (cancelled) return;
        const visible: Promotion[] = (r.data || []).filter((p: Promotion) => !isDismissed(p));
        setPromos(visible);
      })
      .catch(() => setPromos([]));
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate when there are multiple
  useEffect(() => {
    if (promos.length <= 1) return;
    const t = setInterval(() => setActive(i => (i + 1) % promos.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [promos.length]);

  const handleDismiss = () => {
    const current = promos[active];
    if (!current) return;
    markDismissed(current);
    const next = promos.filter((_, i) => i !== active);
    setPromos(next);
    setActive(prev => Math.max(0, Math.min(prev, next.length - 1)));
  };

  const current = promos[active];
  const daysLeft = useMemo(() => {
    if (!current) return null;
    return Math.max(0, differenceInDays(parseISO(current.endsAt), new Date()) + 1);
  }, [current]);

  if (!current) return null;

  return (
    <div dir="rtl" className="relative overflow-hidden rounded-2xl shadow-lg group">
      {/* Background — image (with darken gradient) OR gradient fallback */}
      <div className="absolute inset-0">
        {current.imageUrl ? (
          <>
            <img src={current.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-brand-900/95 via-brand-900/75 to-brand-900/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-rose-500 to-purple-700" />
        )}
        {/* Subtle dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 sm:px-7 py-5 text-white">
        <div className={`flex items-start gap-4 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
          {/* Sparkle icon */}
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-200" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 mb-1.5 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-brand-900">
                <Sparkles className="w-2.5 h-2.5" />
                {isAr ? 'عرض جديد' : 'New offer'}
              </span>
              {daysLeft != null && daysLeft > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 backdrop-blur-sm border border-white/20">
                  {isAr
                    ? (daysLeft === 1 ? 'متبقي يوم واحد' : `متبقي ${daysLeft} يوم`)
                    : (daysLeft === 1 ? '1 day left' : `${daysLeft} days left`)}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold leading-tight drop-shadow-sm">{current.title}</h3>
            {current.description && (
              <p className="text-sm sm:text-[13.5px] text-white/85 mt-1.5 leading-relaxed line-clamp-2">
                {current.description}
              </p>
            )}

            <div className={`mt-3 flex items-center gap-3 flex-wrap ${isAr ? 'flex-row-reverse' : ''}`}>
              {current.ctaUrl && current.ctaLabel && (
                <a
                  href={current.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white text-brand-900 hover:bg-amber-100 px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                >
                  {current.ctaLabel}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <span className="text-[11px] text-white/60">
                {isAr ? 'حتى ' : 'Valid till '}
                <span dir="ltr" className="font-semibold text-white/85">
                  {format(parseISO(current.endsAt), 'dd MMM yyyy', { locale })}
                </span>
              </span>
            </div>
          </div>

          {/* Close + nav buttons */}
          <div className={`flex flex-col items-center gap-2 flex-shrink-0 ${isAr ? '' : ''}`}>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-colors"
              aria-label={isAr ? 'إغلاق' : 'Dismiss'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {promos.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActive(i => (i - 1 + promos.length) % promos.length)}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  aria-label="Previous"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setActive(i => (i + 1) % promos.length)}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  aria-label="Next"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pagination dots */}
        {promos.length > 1 && (
          <div className={`flex items-center gap-1.5 mt-4 ${isAr ? 'justify-start' : 'justify-end'}`}>
            {promos.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                aria-label={`Go to ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
