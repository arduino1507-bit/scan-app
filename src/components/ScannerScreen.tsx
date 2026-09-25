import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource
} from '@zxing/library';
import {
  Flashlight,
  FlashlightOff,
  ArrowLeft,
  Camera,
  RefreshCw,
  Layers,
  Sparkles,
  Keyboard,
  ShieldCheck,
  ShieldAlert,
  Filter,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { playFeedback, playDuplicateFeedback } from '../utils/feedback';
import {
  addLocalScan,
  checkIsDuplicate,
  getDedupeMode,
  setDedupeMode,
  DedupeMode,
  getMaskSettings,
  checkMaskMatches
} from '../services/storage';
import { syncPendingScans } from '../services/sync';
import { ScanItem } from '../types';
import { FormattedBarcode } from './FormattedBarcode';
import { MaskSettingsModal } from './MaskSettingsModal';

interface ScannerScreenProps {
  onBack: () => void;
  onScanned: (item: ScanItem) => void;
  showToast: (message: string, code?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({
  onBack,
  onScanned,
  showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  // Zoom feature state
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [currentZoom, setCurrentZoom] = useState(1);

  // Deduplication mode state
  const [dedupeMode, setDedupeModeState] = useState<DedupeMode>(getDedupeMode());

  // Mask settings state
  const [maskSettings, setMaskSettings] = useState(getMaskSettings());
  const [showMaskModal, setShowMaskModal] = useState(false);

  // Manual code entry dialog
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');

  // Cooldown to prevent multiple scans of the same code in a split second
  const lastScanTimestamp = useRef<number>(0);
  const lastScanText = useRef<string>('');

  const toggleDedupeMode = () => {
    let next: DedupeMode = 'day';
    if (dedupeMode === 'day') next = 'all';
    else if (dedupeMode === 'all') next = 'off';
    else next = 'day';

    setDedupeModeState(next);
    setDedupeMode(next);

    if (next === 'day') {
      showToast('Захист від дублікатів: Увімкнено (за поточний день)', undefined, 'info');
    } else if (next === 'all') {
      showToast('Захист від дублікатів: Суворий (за весь час)', undefined, 'info');
    } else {
      showToast('Захист від дублікатів: Вимкнено (дозволені повтори)', undefined, 'warning');
    }
  };

  const handleScanSuccess = useCallback(
    (codeText: string, formatName?: string) => {
      const now = Date.now();
      const trimmed = codeText.trim();

      // Debounce camera frame bursts
      if (trimmed === lastScanText.current && now - lastScanTimestamp.current < 1600) {
        return;
      }
      lastScanTimestamp.current = now;
      lastScanText.current = trimmed;

      // 1. Check Mask filter first!
      // Silently ignore non-matching codes without sound or toasts so as not to distract the user
      const maskCheck = checkMaskMatches(trimmed);
      if (!maskCheck.matches) {
        return;
      }

      // 2. Check for duplicates
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const duplicateFound = checkIsDuplicate(trimmed, dateStr, dedupeMode);

      if (duplicateFound) {
        playDuplicateFeedback();

        const timeWas = new Date(duplicateFound.timestamp).toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const dayMsg = duplicateFound.dateStr === dateStr ? `сьогодні о ${timeWas}` : `(${duplicateFound.dateStr})`;
        showToast(
          `Дублікат! Цей код вже було додано ${dayMsg}`,
          trimmed,
          'warning'
        );
        return;
      }

      // 3. Play success chime & haptic
      playFeedback();

      // Save locally
      const item = addLocalScan(trimmed, formatName || 'BARCODE');
      setLastCode(trimmed);
      setScanCount((prev) => prev + 1);

      // Notify parent & trigger toast
      onScanned(item);
      showToast('Штрих-код успішно відскановано!', trimmed, 'success');

      // Auto background sync to Google Sheets
      syncPendingScans().catch((err) => {
        console.warn('Background sync on scan failed:', err);
      });
    },
    [dedupeMode, onScanned, showToast]
  );

  // Setup ZXing MultiFormatReader with TRY_HARDER and all barcode formats
  const readerRef = useRef<MultiFormatReader | null>(null);
  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX
    ]);
    const reader = new MultiFormatReader();
    reader.setHints(hints);
    readerRef.current = reader;
  }, []);

  // Inspect track features (torch, zoom, continuous autofocus)
  const inspectAndConfigureTrack = useCallback(async (track: MediaStreamTrack) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};

      if ('torch' in capabilities) {
        setHasTorch(true);
      }

      if (capabilities.zoom) {
        setSupportsZoom(true);
        setMinZoom(capabilities.zoom.min ?? 1);
        setMaxZoom(capabilities.zoom.max ?? 5);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings: any = track.getSettings ? track.getSettings() : {};
        if (settings.zoom) {
          setCurrentZoom(settings.zoom);
        }
      } else {
        setSupportsZoom(false);
      }

      // APK / Native WebView Hardware Optimization: Continuous Focus & Exposure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const advancedConstraints: any = {};

      if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
        if (capabilities.focusMode.includes('continuous')) {
          advancedConstraints.focusMode = 'continuous';
        }
      }

      if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode)) {
        if (capabilities.exposureMode.includes('continuous')) {
          advancedConstraints.exposureMode = 'continuous';
        }
      }

      if (capabilities.whiteBalanceMode && Array.isArray(capabilities.whiteBalanceMode)) {
        if (capabilities.whiteBalanceMode.includes('continuous')) {
          advancedConstraints.whiteBalanceMode = 'continuous';
        }
      }

      if (Object.keys(advancedConstraints).length > 0) {
        try {
          await track.applyConstraints({
            advanced: [advancedConstraints]
          });
        } catch {
          // Ignore constraint errors
        }
      }
    } catch (e) {
      console.warn('Track configuration warning:', e);
    }
  }, []);

  const handleZoomChange = async (targetZoom: number) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const clamped = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    try {
      await track.applyConstraints({
        advanced: [{ zoom: clamped } as unknown as MediaTrackConstraintSet],
      });
      setCurrentZoom(clamped);
    } catch (e) {
      console.warn('Zoom change failed:', e);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const newTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: newTorch } as unknown as MediaTrackConstraintSet],
        });
        setTorchOn(newTorch);
      }
    } catch (e) {
      console.warn('Torch toggle error:', e);
      showToast('Ліхтарик не підтримується на цьому пристрої/камері', undefined, 'warning');
      setHasTorch(false);
    }
  };

  // FULL-SCREEN FULL-FRAME Dual-Orientation Barcode Decoder Loop (0° Horizontal + 90° Vertical)
  // Scans the ENTIRE camera viewport edge-to-edge with crisp downsampling
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const reader = readerRef.current;

    if (!video || !canvas || !reader) return;

    // Helper canvas for 90-degree rotated detection
    let rotCanvas: HTMLCanvasElement | null = null;
    let lastDecodeTime = 0;

    const scanFrame = () => {
      if (!isScanningRef.current) return;

      const now = performance.now();
      // Scan every ~60ms for ultra-responsive instant detection
      if (now - lastDecodeTime >= 60 && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        lastDecodeTime = now;

        const w = video.videoWidth;
        const h = video.videoHeight;

        // Optimal processing resolution: 960px max dimension ensures crystal clear barcode lines for small serial codes
        const scale = Math.min(1, 960 / Math.max(w, h));
        const sw = Math.floor(w * scale);
        const sh = Math.floor(h * scale);

        if (canvas.width !== sw || canvas.height !== sh) {
          canvas.width = sw;
          canvas.height = sh;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // 1. Draw entire full video frame (Horizontal orientation - FULL FIELD OF VIEW)
          ctx.drawImage(video, 0, 0, sw, sh);

          let detected = false;
          try {
            const lumSource = new HTMLCanvasElementLuminanceSource(canvas);
            const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
            const result = reader.decode(bitmap);
            if (result && result.getText()) {
              detected = true;
              handleScanSuccess(result.getText(), result.getBarcodeFormat()?.toString());
            }
          } catch {
            // No barcode detected in horizontal pass
          }

          // 2. If not detected, check VERTICAL orientation (Full-frame rotated 90 degrees)
          if (!detected) {
            try {
              if (!rotCanvas) {
                rotCanvas = document.createElement('canvas');
              }
              if (rotCanvas.width !== sh || rotCanvas.height !== sw) {
                rotCanvas.width = sh;
                rotCanvas.height = sw;
              }
              const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });
              if (rotCtx) {
                rotCtx.save();
                rotCtx.translate(sh / 2, sw / 2);
                rotCtx.rotate((90 * Math.PI) / 180);
                rotCtx.drawImage(canvas, -sw / 2, -sh / 2);
                rotCtx.restore();

                const rotLumSource = new HTMLCanvasElementLuminanceSource(rotCanvas);
                const rotBitmap = new BinaryBitmap(new HybridBinarizer(rotLumSource));
                const rotResult = reader.decode(rotBitmap);
                if (rotResult && rotResult.getText()) {
                  handleScanSuccess(rotResult.getText(), rotResult.getBarcodeFormat()?.toString());
                }
              }
            } catch {
              // No vertical barcode found in this frame either
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    isScanningRef.current = true;
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleScanSuccess]);

  // Robust High-Quality Camera Startup optimized for Android APK (WebView)
  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setCameraError(null);

    // Stop existing loop and stream
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      setIsInitializing(false);
      return;
    }

    let stream: MediaStream | null = null;

    // Optimized stream acquisition:
    // Try Full HD 1080p environment camera (back) first with ideal: 1920x1080
    // Perfectly suited for APK Android WebViews with hardware camera access
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 20 },
        },
      });
    } catch {
      try {
        // Fallback to 720p / environment
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        try {
          // Fallback to standard environment facingMode
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' },
          });
        } catch {
          try {
            // Absolute fallback to any camera available
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true,
            });
          } catch (err: unknown) {
            console.error('All camera attempts failed:', err);
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
              setCameraError('Доступ до камери заборонено. Надайте дозвіл у налаштуваннях додатку/браузера.');
            } else {
              setCameraError('Не вдалося запустити камеру. Перевірте дозволи або скористайтеся ручним введенням.');
            }
            setIsInitializing(false);
            return;
          }
        }
      }
    }

    if (!stream) {
      setCameraError('Не вдалося отримати потік камери.');
      setIsInitializing(false);
      return;
    }

    streamRef.current = stream;

    try {
      const track = stream.getVideoTracks()[0];
      if (track) {
        await inspectAndConfigureTrack(track);
      }

      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('muted', 'true');
      videoElement.muted = true;

      await videoElement.play().catch((e) => console.warn('Play error:', e));

      setIsInitializing(false);
      // Start full-screen dual-orientation scanning loop
      runDetectionLoop();
    } catch (e) {
      console.error('Video startup error:', e);
      setIsInitializing(false);
    }
  }, [inspectAndConfigureTrack, runDetectionLoop]);

  useEffect(() => {
    let isMounted = true;

    // Small delay to ensure the DOM is ready
    const timer = setTimeout(() => {
      if (isMounted) {
        startCamera();
      }
    }, 60);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      isScanningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;

    handleScanSuccess(manualCodeInput.trim(), 'MANUAL_ENTRY');
    setManualCodeInput('');
    setShowManualModal(false);
  };

  const handleMaskSaved = (prefix: string, enabled: boolean) => {
    setMaskSettings({ prefix, enabled });
    if (enabled && prefix) {
      showToast(`Маску активовано: тільки коди з "${prefix}..."`, undefined, 'info');
    } else {
      showToast('Маску вимкнено: зчитуються будь-які штрих-коди', undefined, 'info');
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-40 select-none overflow-hidden text-white font-sans">
      {/* Hidden processing canvas for full-frame analysis and 90° rotation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header Bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 pt-10 pb-3 bg-gradient-to-b from-black/85 via-black/50 to-transparent">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 active:scale-95 transition-all text-slate-200"
          aria-label="Назад на головний екран"
        >
          <ArrowLeft className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">Назад</span>
        </button>

        <div className="flex items-center gap-1.5">
          {/* Mask Settings Button */}
          <button
            onClick={() => setShowMaskModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl backdrop-blur-md border text-xs font-bold transition-all active:scale-95 ${
              maskSettings.enabled && maskSettings.prefix
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-lg shadow-amber-950/40'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            title="Налаштування маски штрих-коду"
          >
            <Filter className={`w-3.5 h-3.5 ${maskSettings.enabled ? 'text-amber-400 fill-amber-400/20' : 'text-slate-400'}`} />
            <span>
              {maskSettings.enabled && maskSettings.prefix
                ? `Маска: ${maskSettings.prefix}*`
                : 'Маска'}
            </span>
          </button>

          {/* Deduplication Toggle Button */}
          <button
            onClick={toggleDedupeMode}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl backdrop-blur-md border text-xs font-bold transition-all active:scale-95 ${
              dedupeMode === 'off'
                ? 'bg-slate-900/80 border-slate-700/60 text-slate-400'
                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/40'
            }`}
            title="Перемкнути захист від дублікатів"
          >
            {dedupeMode === 'off' ? (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline">
              {dedupeMode === 'day'
                ? 'Без дублів (день)'
                : dedupeMode === 'all'
                ? 'Без дублів (завжди)'
                : 'Дублікати ВКЛ'}
            </span>
          </button>

          {/* Torch toggle button */}
          <button
            onClick={toggleTorch}
            disabled={!hasTorch && !streamRef.current}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all active:scale-95 flex items-center justify-center ${
              torchOn
                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/50'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-200 hover:text-white'
            }`}
            title={torchOn ? 'Вимкнути ліхтарик' : 'Увімкнути ліхтарик'}
            aria-label="Ліхтарик"
          >
            {torchOn ? (
              <Flashlight className="w-4 h-4 fill-current animate-pulse" />
            ) : (
              <FlashlightOff className="w-4 h-4 text-slate-300" />
            )}
          </button>

          {/* Manual input trigger */}
          <button
            onClick={() => setShowManualModal(true)}
            className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white active:scale-95 transition-all"
            title="Ручне введення номера"
            aria-label="Ручне введення"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Camera Video Viewport (Full Screen, Edge-to-Edge) */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* MAXIMUM SCANNING AREA RETICLE (Takes up nearly full width and generous height) */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3 sm:p-5">
          <div className="relative w-full max-w-sm sm:max-w-md h-[68vh] sm:h-[72vh] rounded-3xl border-2 border-emerald-400/40 shadow-2xl flex items-center justify-center backdrop-contrast-115">
            {/* Prominent Corner Aim accents marking the huge scan zone */}
            <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl shadow-sm" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl shadow-sm" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl shadow-sm" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl shadow-sm" />

            {/* Laser scanning line sweeping full height */}
            <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_#34d399] animate-[scannerLaserWide_2.2s_ease-in-out_infinite]" />

            {/* Top guide badge inside the reticle */}
            <div className="absolute top-3 text-center px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] text-emerald-300 font-semibold tracking-wide flex items-center gap-1.5 shadow-lg">
              <Maximize2 className="w-3 h-3 text-emerald-400" />
              <span>Максимальна зона: будь-де в кадрі</span>
            </div>

            {/* Center guide badge */}
            <div className="text-center px-3.5 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-sm border border-slate-800 text-xs text-slate-200 font-medium tracking-wide shadow-lg">
              {maskSettings.enabled && maskSettings.prefix ? (
                <span className="text-amber-300 font-bold">
                  Фільтр: «{maskSettings.prefix}*» • Гориз. і вертик.
                </span>
              ) : (
                'Зчитує горизонтальні та вертикальні коди'
              )}
            </div>
          </div>
        </div>

        {/* Hardware / Digital Zoom Buttons */}
        <div className="absolute bottom-32 inset-x-0 z-20 flex items-center justify-center gap-2 pointer-events-auto px-4">
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-2xl">
            {supportsZoom ? (
              <>
                <button
                  type="button"
                  onClick={() => handleZoomChange(1)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    Math.abs(currentZoom - 1) < 0.2
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  1x
                </button>

                {maxZoom >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleZoomChange(2)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      Math.abs(currentZoom - 2) < 0.2
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    2x
                  </button>
                )}

                {maxZoom >= 3 && (
                  <button
                    type="button"
                    onClick={() => handleZoomChange(3)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      Math.abs(currentZoom - 3) < 0.2
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    3x
                  </button>
                )}

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  type="button"
                  onClick={() => handleZoomChange(currentZoom - 0.5)}
                  disabled={currentZoom <= minZoom}
                  className="p-1 rounded-full text-slate-400 hover:text-white disabled:opacity-30"
                  title="Зменшити зум"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <span className="text-[11px] font-mono text-emerald-300 font-bold min-w-[32px] text-center">
                  {currentZoom.toFixed(1)}x
                </span>

                <button
                  type="button"
                  onClick={() => handleZoomChange(currentZoom + 0.5)}
                  disabled={currentZoom >= maxZoom}
                  className="p-1 rounded-full text-slate-400 hover:text-white disabled:opacity-30"
                  title="Збільшити зум"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1 py-0.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Full HD 1080p • Максимальна область</span>
              </div>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {isInitializing && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-4 z-10 px-6 text-center">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-200">Запуск високоякісної камери...</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Підготовка Full HD матриці та автофокусу для додатка.
            </p>
          </div>
        )}

        {/* Error State */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Камера недоступна</h3>
            <p className="text-sm text-slate-300 mb-6 max-w-xs">{cameraError}</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={startCamera}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <RefreshCw className="w-4 h-4" /> Спробувати знову
              </button>
              <button
                onClick={() => setShowManualModal(true)}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Keyboard className="w-4 h-4" /> Ввести штрих-код вручну
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Status Bar */}
      <footer className="absolute bottom-0 inset-x-0 z-20 px-4 pb-8 pt-4 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center gap-2">
        {lastCode && (
          <div className="w-full max-w-md bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Останній зчитаний код
                </div>
                <div className="text-sm truncate">
                  <FormattedBarcode code={lastCode} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>{scanCount}</span>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          {maskSettings.enabled && maskSettings.prefix ? (
            <span>Активна маска «{maskSettings.prefix}*»: сторонні коди ігноруються автоматично</span>
          ) : (
            <span>Звук і вібрація попередять про зчитування або дублікати</span>
          )}
        </div>
      </footer>

      {/* Manual Input Dialog */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 text-white shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
            <h3 className="text-lg font-bold mb-1">Ручне введення штрих-коду</h3>
            <p className="text-xs text-slate-400 mb-4">
              Якщо штрих-код пошкоджений або слабо освітлений, введіть цифри або символи коду:
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="Наприклад: 4820123456789"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={!manualCodeInput.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mask Settings Dialog */}
      <MaskSettingsModal
        isOpen={showMaskModal}
        onClose={() => setShowMaskModal(false)}
        onSaved={handleMaskSaved}
      />

      {/* Inline laser keyframes style for the large reticle */}
      <style>{`
        @keyframes scannerLaserWide {
          0% { top: 6%; }
          50% { top: 94%; }
          100% { top: 6%; }
        }
      `}</style>
    </div>
  );
};
