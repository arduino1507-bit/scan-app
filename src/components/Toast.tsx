import React from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { AppNotification } from '../types';
import { FormattedBarcode } from './FormattedBarcode';

interface ToastProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex flex-col items-center pointer-events-none px-4 space-y-2">
      {notifications.map((n) => {
        let bg = 'bg-slate-900 border-slate-700 text-slate-100';
        let icon = <Info className="w-5 h-5 text-sky-400 shrink-0" />;

        if (n.type === 'success') {
          bg = 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50';
          icon = <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
        } else if (n.type === 'warning') {
          bg = 'bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-amber-950/50';
          icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
        } else if (n.type === 'error') {
          bg = 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/50';
          icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
        }

        return (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 w-full max-w-md px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${bg}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {icon}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium leading-snug">{n.message}</span>
                {n.code && (
                  <div className="text-xs truncate tracking-wider mt-0.5">
                    <FormattedBarcode code={n.code} />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismiss(n.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors shrink-0"
              aria-label="Закрити"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
