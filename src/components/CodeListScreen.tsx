import React, { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Printer,
  Copy,
  Check,
  Calendar,
  CloudCheck,
  CloudOff,
  Trash2,
  ExternalLink,
  Barcode,
  SlidersHorizontal
} from 'lucide-react';
import { ScanItem } from '../types';
import { deleteScanItem, deleteDayScans } from '../services/storage';
import { FormattedBarcode } from './FormattedBarcode';
import { BarcodeLabel, LabelPrintMode } from './BarcodeLabel';

interface CodeListScreenProps {
  dateStr: string;
  items: ScanItem[];
  spreadsheetUrl?: string | null;
  onBack: () => void;
  onRefresh: () => void;
  showToast: (message: string, code?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CodeListScreen: React.FC<CodeListScreenProps> = ({
  dateStr,
  items,
  spreadsheetUrl,
  onBack,
  onRefresh,
  showToast,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [singlePrintItem, setSinglePrintItem] = useState<ScanItem | null>(null);

  // Label print mode selection: 'both' | 'barcode_only' | 'text_only'
  const [printMode, setPrintMode] = useState<LabelPrintMode>('both');

  // Format date readable in Ukrainian
  const formatHeaderDate = (d: string) => {
    try {
      const [year, month, day] = d.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'short',
      });
    } catch {
      return d;
    }
  };

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      showToast('Штрих-код скопійовано в буфер', code, 'info');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Не вдалося скопіювати код', undefined, 'error');
    }
  };

  // WhatsApp share - ONLY pure codes, line by line
  const handleShareWhatsApp = () => {
    if (items.length === 0) {
      showToast('Список штрих-кодів порожній', undefined, 'warning');
      return;
    }

    const pureCodesText = items.map((item) => item.code.trim()).join('\n');
    const fullMessage = encodeURIComponent(pureCodesText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${fullMessage}`;

    window.open(whatsappUrl, '_blank');
    showToast('Перехід у WhatsApp...', undefined, 'info');
  };

  // Generic share API (Android system share) - ONLY codes
  const handleNativeShare = async (codeToShare?: string) => {
    const textContent = codeToShare ? codeToShare.trim() : items.map((i) => i.code.trim()).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          text: textContent,
        });
      } catch (e: unknown) {
        if ((e as Error)?.name !== 'AbortError') {
          handleShareWhatsApp();
        }
      }
    } else {
      handleShareWhatsApp();
    }
  };

  // Open modal for all items
  const handlePrintAll = () => {
    setSinglePrintItem(null);
    setShowPrintModal(true);
  };

  // Print a single specific barcode
  const handlePrintSingle = (item: ScanItem) => {
    setSinglePrintItem(item);
    setShowPrintModal(true);
  };

  const handleSystemPrint = () => {
    window.print();
  };

  const handleDeleteItem = (id: string) => {
    deleteScanItem(id);
    onRefresh();
    showToast('Запис видалено', undefined, 'info');
  };

  const handleDeleteAll = () => {
    if (confirm(`Видалити всі ${items.length} штрих-кодів за ${dateStr}?`)) {
      deleteDayScans(dateStr);
      onRefresh();
      onBack();
      showToast('Усі штрих-коди за день видалено', undefined, 'info');
    }
  };

  // Determine what is being printed (single barcode or whole list)
  const itemsToPrint = singlePrintItem ? [singlePrintItem] : items;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-12">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            aria-label="Назад до списку дат"
          >
            <ArrowLeft className="w-5 h-5 text-emerald-400" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white capitalize leading-tight">
              {formatHeaderDate(dateStr)}
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3 h-3 text-emerald-400" />
              {dateStr} • {items.length} шт.
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDeleteAll}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
            title="Видалити день"
            aria-label="Очистити день"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
              title="Відкрити в Google Таблицях"
              aria-label="Google Таблиця"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </header>

      {/* Top Global Action Buttons: WhatsApp & Niimbot */}
      <div className="p-3 sm:p-4 grid grid-cols-2 gap-2.5 max-w-lg mx-auto w-full">
        {/* Share WhatsApp */}
        <button
          onClick={handleShareWhatsApp}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span className="truncate">У WhatsApp</span>
        </button>

        {/* Niimbot Print All */}
        <button
          onClick={handlePrintAll}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-950/40 transition-all"
        >
          <Printer className="w-4 h-4 shrink-0" />
          <span className="truncate">На Niimbot (Всі)</span>
        </button>
      </div>

      {/* Items list with single-line guarantee and dedicated Print button for each barcode */}
      <main className="flex-1 px-3 sm:px-4 max-w-lg mx-auto w-full space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-800/40 rounded-3xl border border-slate-800/60 mt-4">
            <Barcode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">У цей день сканувань не було</p>
            <p className="text-xs text-slate-500 mt-1">Відскануйте нові штрих-коди за допомогою камери</p>
          </div>
        ) : (
          items.map((item, index) => {
            const timeStr = new Date(item.timestamp).toLocaleTimeString('uk-UA', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.id}
                className="bg-slate-800/90 border border-slate-700/70 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-sm hover:border-slate-600 transition-all"
              >
                {/* Left side: index + single-line barcode & time */}
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    {/* Strictly single-line barcode text, auto-sized with last 4 digits highlighted */}
                    <div className="text-sm sm:text-base whitespace-nowrap overflow-x-auto scrollbar-none leading-none py-0.5">
                      <FormattedBarcode code={item.code} />
                    </div>

                    {/* Metadata line: time + sync status */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 whitespace-nowrap">
                      <span>{timeStr}</span>
                      <span>•</span>
                      {item.synced ? (
                        <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                          <CloudCheck className="w-3 h-3" /> Таблиця
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                          <CloudOff className="w-3 h-3" /> Офлайн
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Action buttons including dedicated PRINT button for each code */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Dedicated Print button for this specific barcode */}
                  <button
                    onClick={() => handlePrintSingle(item)}
                    className="p-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 transition-colors active:scale-95 flex items-center justify-center"
                    title="Друк цього штрих-коду на Niimbot"
                    aria-label="Друк етикетки"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {/* Copy button */}
                  <button
                    onClick={() => handleCopyCode(item.code, item.id)}
                    className="p-2 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors active:scale-95"
                    title="Скопіювати штрих-код"
                    aria-label="Копіювати"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 rounded-xl bg-slate-700/70 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors active:scale-95"
                    title="Видалити запис"
                    aria-label="Видалити"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Niimbot Printer Modal & Label Generator (Handles single or all items + Mode selection) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">
                    {singlePrintItem ? 'Друк штрих-коду на Niimbot' : 'Друк усіх етикеток на Niimbot'}
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    {itemsToPrint.length === 1 ? '1 етикетка' : `${itemsToPrint.length} етикеток`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* SELECTION OF PRINT MODE (Штрих-код + Серійний номер / Тільки штрих-код / Тільки номер) */}
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                <span>Оберіть формат друку етикетки:</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {/* Option 1: Штрих-код та серійний номер */}
                <button
                  type="button"
                  onClick={() => setPrintMode('both')}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    printMode === 'both'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-200 font-bold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>Друк штрих-коду та серійного номера</span>
                  </div>
                  {printMode === 'both' && <Check className="w-4 h-4 text-sky-400" />}
                </button>

                {/* Option 2: Тільки штрих-код */}
                <button
                  type="button"
                  onClick={() => setPrintMode('barcode_only')}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    printMode === 'barcode_only'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-200 font-bold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>Друк тільки штрих-коду</span>
                  </div>
                  {printMode === 'barcode_only' && <Check className="w-4 h-4 text-sky-400" />}
                </button>

                {/* Option 3: Тільки серійний номер */}
                <button
                  type="button"
                  onClick={() => setPrintMode('text_only')}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    printMode === 'text_only'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-200 font-bold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>Друк тільки серійного номера</span>
                  </div>
                  {printMode === 'text_only' && <Check className="w-4 h-4 text-sky-400" />}
                </button>
              </div>
            </div>

            {/* Label Preview Container */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 mb-4">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider">
                Попередній перегляд етикетки
              </div>
              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {itemsToPrint.slice(0, 5).map((item) => (
                  <BarcodeLabel
                    key={item.id}
                    code={item.code}
                    height={44}
                    width={1.6}
                    fontSize={16}
                    mode={printMode}
                  />
                ))}
                {itemsToPrint.length > 5 && (
                  <div className="text-center text-xs text-slate-500 py-1">
                    ... і ще {itemsToPrint.length - 5} етикеток
                  </div>
                )}
              </div>
            </div>

            {/* Print action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleSystemPrint}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Надіслати на друк (Системний принтер / Bluetooth)</span>
              </button>

              <button
                onClick={() => handleNativeShare(singlePrintItem ? singlePrintItem.code : undefined)}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Відкрити в додатку Niimbot через «Поділитися»</span>
              </button>

              <button
                onClick={() => setShowPrintModal(false)}
                className="w-full py-2.5 text-center text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print stylesheet for thermal label printer */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff;
            color: #000000;
          }
          .thermal-label-item {
            page-break-after: always;
            padding: 2mm;
            display: flex;
            justify-content: center;
            align-items: center;
            border-bottom: 1px dashed #ddd;
          }
        }
      `}</style>

      {/* Hidden container dedicated for window.print() matching the user's chosen mode */}
      <div id="print-area" className="hidden">
        {itemsToPrint.map((item) => (
          <div key={item.id} className="thermal-label-item">
            <BarcodeLabel
              code={item.code}
              height={46}
              width={1.7}
              fontSize={17}
              mode={printMode}
              className="border-none shadow-none p-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
