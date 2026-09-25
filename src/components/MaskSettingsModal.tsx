import React, { useState, useEffect } from 'react';
import { Filter, Check, X, Info, Sparkles } from 'lucide-react';
import { getMaskSettings, saveMaskSettings } from '../services/storage';

interface MaskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (prefix: string, enabled: boolean) => void;
}

export const MaskSettingsModal: React.FC<MaskSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [prefixInput, setPrefixInput] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getMaskSettings();
      setPrefixInput(current.prefix);
      setIsEnabled(current.enabled);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = prefixInput.trim();
    // If prefix is empty, force disabled
    const shouldEnable = isEnabled && clean.length > 0;
    saveMaskSettings(clean, shouldEnable);
    onSaved(clean, shouldEnable);
    onClose();
  };

  const handleDisable = () => {
    saveMaskSettings('', false);
    setPrefixInput('');
    setIsEnabled(false);
    onSaved('', false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 text-white shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Налаштування маски штрих-коду</h3>
              <p className="text-[11px] text-slate-400">Фільтрація кодів за першими символами</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Toggle Enable/Disable */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div>
              <div className="text-sm font-bold text-white">Активувати фільтр маски</div>
              <div className="text-xs text-slate-400">
                Зчитувати тільки ті штрих-коди, які починаються на заданий префікс
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Mask Prefix Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Початкові символи (Префікс маски):
            </label>
            <div className="relative">
              <input
                type="text"
                value={prefixInput}
                onChange={(e) => setPrefixInput(e.target.value)}
                placeholder="Наприклад: 482 або 200 або ABC"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {prefixInput && (
                <button
                  type="button"
                  onClick={() => setPrefixInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Як це працює:</span>
            </div>
            <p>
              • Якщо ви введете, наприклад, <strong>482</strong>, програма зчитуватиме <strong>виключно</strong> коди, що починаються з <strong>482...</strong>
            </p>
            <p>
              • Усі сторонні штрих-коди (наприклад, 400... чи випадкові QR-коди) будуть <strong>беззвучно ігноруватися</strong> без зайвих сповіщень. Сканер спокійно очікуватиме потрібний код.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDisable}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
            >
              Скинути маску
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Зберегти</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
