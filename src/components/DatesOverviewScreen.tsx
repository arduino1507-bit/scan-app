import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { DayGroup } from '../types';
import { syncPendingScans } from '../services/sync';

interface DatesOverviewScreenProps {
  dayGroups: DayGroup[];
  spreadsheetUrl?: string | null;
  isSyncing: boolean;
  onSelectDate: (dateStr: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  showToast: (message: string, code?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const DatesOverviewScreen: React.FC<DatesOverviewScreenProps> = ({
  dayGroups,
  spreadsheetUrl,
  isSyncing,
  onSelectDate,
  onBack,
  onRefresh,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Format date readable in Ukrainian
  const formatDisplayDate = (d: string) => {
    try {
      const [year, month, day] = d.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const formatWeekday = (d: string) => {
    try {
      const [year, month, day] = d.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('uk-UA', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  // Filter groups if searching
  const filteredGroups = dayGroups.filter((g) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    if (g.dateStr.includes(term)) return true;
    return g.items.some((item) => item.code.toLowerCase().includes(term));
  });

  const handleManualSync = async () => {
    showToast('Синхронізація з Google Таблицею...', undefined, 'info');
    const res = await syncPendingScans();
    onRefresh();
    if (res.error) {
      showToast(`Помилка синхронізації: ${res.error}`, undefined, 'error');
    } else if (res.synced > 0) {
      showToast(`Успішно надіслано ${res.synced} штрих-кодів у Google Таблицю!`, undefined, 'success');
    } else {
      showToast('Усі дані вже синхронізовані з Google Таблицею', undefined, 'info');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            aria-label="Назад на головну"
          >
            <ArrowLeft className="w-5 h-5 text-emerald-400" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Перегляд сканів по датах</h1>
            <p className="text-xs text-slate-400">Оберіть дату для перегляду записів</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`p-2.5 rounded-xl border transition-all ${
              isSyncing
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:scale-95'
            }`}
            title="Синхронізувати з Google Таблицею"
            aria-label="Синхронізувати"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-emerald-400 hover:text-white transition-colors"
              title="Відкрити таблицю Scan"
              aria-label="Google Таблиця"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <div className="p-4 max-w-lg mx-auto w-full">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Пошук за датою або номером штрих-коду..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Color Legend required by user brief */}
        <div className="mt-3 flex items-center justify-between text-xs px-1">
          <span className="text-slate-400 font-medium">Статус синхронізації:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              У таблиці
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              Чекає інтернету
            </span>
          </div>
        </div>
      </div>

      {/* Date Buttons List */}
      <main className="flex-1 px-4 max-w-lg mx-auto w-full space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-800/40 rounded-3xl border border-slate-800/60 mt-2">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">Штрих-кодів не знайдено</p>
            <p className="text-xs text-slate-500 mt-1">
              Натисніть «Почати сканування» на головному екрані для зчитування штрих-кодів.
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isAllSynced = group.allSynced && group.pendingCount === 0;

            const cardClasses = isAllSynced
              ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400/70 hover:bg-emerald-950/60 text-emerald-100 shadow-emerald-950/30'
              : 'bg-amber-950/40 border-amber-500/40 hover:border-amber-400/70 hover:bg-amber-950/60 text-amber-100 shadow-amber-950/30';

            const badgeBg = isAllSynced
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

            const icon = isAllSynced ? (
              <CloudCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <CloudOff className="w-5 h-5 text-amber-400 shrink-0" />
            );

            return (
              <button
                key={group.dateStr}
                onClick={() => onSelectDate(group.dateStr)}
                className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] shadow-lg flex items-center justify-between gap-4 ${cardClasses}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 shrink-0">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold capitalize leading-snug truncate">
                      {formatDisplayDate(group.dateStr)}
                    </div>
                    <div className="text-xs opacity-75 font-medium capitalize mt-0.5">
                      {formatWeekday(group.dateStr)} • {group.dateStr}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                        {group.count} {group.count === 1 ? 'код' : group.count < 5 ? 'коди' : 'кодів'}
                      </span>

                      {!isAllSynced && (
                        <span className="text-[11px] font-semibold text-amber-300">
                          {group.pendingCount} не надіслано
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-70 shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            );
          })
        )}
      </main>
    </div>
  );
};
