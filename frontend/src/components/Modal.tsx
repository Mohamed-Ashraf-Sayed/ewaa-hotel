import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${sizes[size]} max-h-[95vh] sm:max-h-[90vh] flex flex-col
        rounded-t-2xl sm:rounded-xl shadow-elevated`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-100 flex-shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-400 transition-all duration-200">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base sm:text-lg font-bold text-brand-900 truncate">{title}</h2>
        </div>
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
