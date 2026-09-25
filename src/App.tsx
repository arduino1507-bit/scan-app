import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Layers,
  Sparkles,
  CloudCheck,
  CloudOff,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, subscribeAuth } from './services/auth';
import { getLocalScans, getMaskSettings } from './services/storage';
import { syncPendingScans, initAutoSyncListener, subscribeSync } from './services/sync';
import { getOrCreateScanSpreadsheet } from './services/sheets';
import { ScanItem, DayGroup, AppNotification } from './types';
import { ScannerScreen } from './components/ScannerScreen';
import { DatesOverviewScreen } from './components/DatesOverviewScreen';
import { CodeListScreen } from './components/CodeListScreen';
import { ToastContainer } from './components/Toast';
import { AuthHeader } from './components/AuthHeader';
import { RandomBarcodeHero } from './components/RandomBarcodeHero';
import { MaskSettingsModal } from './components/MaskSettingsModal';

export default function App() {
  // Screens: 'home' | 'scanner' | 'dates' | 'date_detail'
  const [currentScreen, setCurrentScreen] = useState<'home' | 'scanner' | 'dates' | 'date_detail'>('home');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Data & sync state
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Mask filter state on Home
  const [maskSettings, setMaskSettings] = useState(getMaskSettings());
  const [showHomeMaskModal, setShowHomeMaskModal] = useState(false);

  // Load scans from local storage
  const refreshScans = useCallback(() => {
    const list = getLocalScans();
    setScans(list);
    setMaskSettings(getMaskSettings());
  }, []);

  const showToast = useCallback((
    message: string,
    code?: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'info'
  ) => {
    const newNotice: AppNotification = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      message,
      code,
      type,
      timestamp: Date.now(),
    };

    setNotifications((prev) => [...prev, newNotice]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotice.id));
    }, 4000);
  }, []);

  const dismissToast = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Auth initialization
  useEffect(() => {
    refreshScans();

    const unsubscribeAuth = subscribeAuth((token, currentUser) => {
      setHasToken(!!token);
      setUser(currentUser);

      if (token) {
        getOrCreateScanSpreadsheet(token)
          .then((info) => {
            setSpreadsheetUrl(info.url);
          })
          .catch((err) => {
            console.warn('Initial spreadsheet check:', err);
          });
      }
    });

    const unsubscribeState = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setHasToken(!!token);
      },
      () => {}
    );

    const unsubscribeSync = subscribeSync((status) => {
      setIsSyncing(status.isSyncing);
      if (status.spreadsheetUrl) {
        setSpreadsheetUrl(status.spreadsheetUrl);
      }
      refreshScans();
    });

    const cleanupAutoSync = initAutoSyncListener();

    return () => {
      unsubscribeAuth();
      if (typeof unsubscribeState === 'function') unsubscribeState();
      unsubscribeSync();
      cleanupAutoSync();
    };
  }, [refreshScans]);

  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasToken(true);
        showToast('Вхід успішно виконано!', undefined, 'success');

        try {
          const sheetInfo = await getOrCreateScanSpreadsheet(res.token);
          setSpreadsheetUrl(sheetInfo.url);
          showToast(`Таблицю підключено: ${sheetInfo.title}`, undefined, 'success');
        } catch (sheetErr) {
          console.error('Spreadsheet create error:', sheetErr);
        }
      }
    } catch (e: unknown) {
      console.error('Login error:', e);
      showToast('Помилка авторизації Google. Перевірте спливаючі вікна.', undefined, 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
    showToast('Вихід з облікового запису виконано', undefined, 'info');
  };

  const handleManualSyncNow = async () => {
    if (isSyncing) return;
    try {
      showToast('Синхронізація з Google Таблицею...', undefined, 'info');
      const res = await syncPendingScans();
      if (res.syncedCount > 0) {
        showToast(`Успішно додано ${res.syncedCount} кодів у таблицю "Scan"`, undefined, 'success');
      } else {
        showToast('Усі коди вже збережені в таблиці', undefined, 'info');
      }
      refreshScans();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Помилка синхронізації';
      showToast(msg, undefined, 'error');
    }
  };

  // Group scans by date
  const dayGroups: DayGroup[] = useMemo(() => {
    const map = new Map<string, ScanItem[]>();
    for (const s of scans) {
      const arr = map.get(s.dateStr) || [];
      arr.push(s);
      map.set(s.dateStr, arr);
    }

    const groups: DayGroup[] = [];
    for (const [dateStr, items] of map.entries()) {
      const syncedCount = items.filter((i) => i.synced).length;
      const pendingCount = items.length - syncedCount;
      groups.push({
        dateStr,
        count: items.length,
        syncedCount,
        pendingCount,
        allSynced: pendingCount === 0 && items.length > 0,
        items,
      });
    }

    groups.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    return groups;
  }, [scans]);

  const totalScans = scans.length;
  const pendingScansCount = scans.filter((s) => !s.synced).length;
  const isAllSynced = pendingScansCount === 0 && totalScans > 0;

  // Sub-screens
  if (currentScreen === 'scanner') {
    return (
      <>
        <ScannerScreen
          onBack={() => {
            setCurrentScreen('home');
            refreshScans();
          }}
          onScanned={() => {
            refreshScans();
          }}
          showToast={showToast}
        />
        <ToastContainer notifications={notifications} onDismiss={dismissToast} />
      </>
    );
  }

  if (currentScreen === 'dates') {
    return (
      <>
        <DatesOverviewScreen
          dayGroups={dayGroups}
          spreadsheetUrl={spreadsheetUrl}
          isSyncing={isSyncing}
          onSelectDate={(dateStr) => {
            setSelectedDate(dateStr);
            setCurrentScreen('date_detail');
          }}
          onBack={() => {
            setCurrentScreen('home');
            refreshScans();
          }}
          onRefresh={refreshScans}
          showToast={showToast}
        />
        <ToastContainer notifications={notifications} onDismiss={dismissToast} />
      </>
    );
  }

  if (currentScreen === 'date_detail' && selectedDate) {
    const currentDayItems = scans.filter((s) => s.dateStr === selectedDate);
    return (
      <>
        <CodeListScreen
          dateStr={selectedDate}
          items={currentDayItems}
          spreadsheetUrl={spreadsheetUrl}
          onBack={() => {
            setCurrentScreen('dates');
            refreshScans();
          }}
          onRefresh={refreshScans}
          showToast={showToast}
        />
        <ToastContainer notifications={notifications} onDismiss={dismissToast} />
      </>
    );
  }

  // MAIN HOME SCREEN:
  return (
    <div className="h-screen h-[100dvh] max-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Google Auth Status Header (compact) */}
      <div className="shrink-0">
        <AuthHeader
          userEmail={user?.email}
          userName={user?.displayName}
          photoURL={user?.photoURL}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isLoading={isAuthLoading}
        />
      </div>

      {/* Main Single Viewport Content Container */}
      <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full px-4 py-3 min-h-0 overflow-hidden">
        {/* Top Hero: Barcode image with NO texts, and title "Сканер штріх-кодів" */}
        <div className="text-center shrink-0 flex flex-col items-center">
          <div className="mb-2.5">
            <RandomBarcodeHero />
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
            Сканер штріх-кодів
          </h1>

          {/* Sync status chip + Mask filter quick status */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            {isAllSynced ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Усі коди синхронізовані ({totalScans})</span>
              </div>
            ) : pendingScansCount > 0 ? (
              <button
                onClick={handleManualSyncNow}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-900/60 active:scale-95 transition-all"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Очікують відправки: {pendingScansCount} шт. (Натисніть)</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">
                <span>Немає збережених кодів</span>
              </div>
            )}

            {/* Quick Mask indicator & button */}
            <button
              onClick={() => setShowHomeMaskModal(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold transition-all active:scale-95 ${
                maskSettings.enabled && maskSettings.prefix
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
              title="Налаштування маски штрих-коду"
            >
              <Filter className={`w-3 h-3 ${maskSettings.enabled ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>
                {maskSettings.enabled && maskSettings.prefix
                  ? `Маска: ${maskSettings.prefix}*`
                  : 'Маска: Вимк.'}
              </span>
            </button>
          </div>
        </div>

        {/* PRIMARY ACTIONS: 2 Core Buttons */}
        <div className="space-y-3 my-auto py-2 shrink-0">
          {/* Button 1: Почати сканування */}
          <button
            onClick={() => setCurrentScreen('scanner')}
            className="w-full relative overflow-hidden group py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base tracking-wide shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="p-2.5 rounded-xl bg-slate-950/20 text-slate-950">
                <Camera className="w-6 h-6" />
              </div>
              <div className="text-lg font-extrabold leading-tight">Почати сканування</div>
            </div>
            <Sparkles className="w-5 h-5 text-slate-950/40 group-hover:text-slate-950 transition-colors" />
          </button>

          {/* Button 2: Перегляд сканів */}
          <button
            onClick={() => setCurrentScreen('dates')}
            className="w-full relative overflow-hidden py-4 px-5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-base shadow-md shadow-slate-950/40 active:scale-[0.98] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-lg font-bold leading-tight">Перегляд сканів</div>
            </div>
            <div className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-700">
              {totalScans} шт.
            </div>
          </button>
        </div>

        {/* Google Spreadsheet Block (compact bottom card) */}
        <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3 flex items-center justify-between shrink-0 mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Таблиця Google "Scan"</div>
              {spreadsheetUrl && (
                <div className="text-[10px] text-emerald-400 truncate">
                  Підключена та синхронізована
                </div>
              )}
            </div>
          </div>

          {spreadsheetUrl ? (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span>Відкрити</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <button
              onClick={hasToken ? handleManualSyncNow : handleLogin}
              className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors shrink-0"
            >
              {hasToken ? 'Перевірити' : 'Увійти'}
            </button>
          )}
        </div>
      </div>

      {/* Global Mask Settings Dialog on Home */}
      <MaskSettingsModal
        isOpen={showHomeMaskModal}
        onClose={() => setShowHomeMaskModal(false)}
        onSaved={(prefix, enabled) => {
          setMaskSettings({ prefix, enabled });
          if (enabled && prefix) {
            showToast(`Маску активовано: тільки коди з "${prefix}..."`, undefined, 'info');
          } else {
            showToast('Маску вимкнено', undefined, 'info');
          }
        }}
      />

      {/* Global Toast / Snackbar Notifications */}
      <ToastContainer notifications={notifications} onDismiss={dismissToast} />
    </div>
  );
}
