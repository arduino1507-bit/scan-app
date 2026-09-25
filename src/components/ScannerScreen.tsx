import React, { useEffect, useState } from 'react';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

interface ScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  const [torch, setTorch] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        // 1. Проверяем и запрашиваем системное разрешение на камеру
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera !== 'granted') {
          alert('Необходимо предоставить доступ к камере в настройках телефона');
          onClose();
          return;
        }

        // 2. Делаем фон веб-оболочки прозрачным, чтобы видеть нативную камеру под ней
        document.body.classList.add('barcode-scanner-active');

        // 3. Подписка на моментальное распознавание штрихкодов
        await BarcodeScanner.addListener('barcodesScanned', async (result) => {
          if (!isMounted) return;
          const code = result.barcodes[0]?.rawValue;
          if (code) {
            setLastScanned(code);
            // Аппаратный виброотклик
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            onScan(code);
          }
        });

        // 4. Запуск системной камеры CameraX со всеми основными форматами
        await BarcodeScanner.startScan({
          formats: [
            BarcodeFormat.Ean13,
            BarcodeFormat.Ean8,
            BarcodeFormat.Code128,
            BarcodeFormat.Code39,
            BarcodeFormat.UpcA,
            BarcodeFormat.UpcE,
            BarcodeFormat.QrCode
          ]
        });
      } catch (err) {
        console.error('Ошибка запуска сканера:', err);
      }
    };

    startCamera();

    // При выходе выключаем камеру и возвращаем обычный фон приложения
    return () => {
      isMounted = false;
      document.body.classList.remove('barcode-scanner-active');
      BarcodeScanner.removeAllListeners();
      BarcodeScanner.stopScan();
    };
  }, [onScan, onClose]);

  // Аппаратное переключение фонарика
  const toggleFlashlight = async () => {
    try {
      await BarcodeScanner.toggleTorch();
      setTorch(!torch);
    } catch (e) {
      console.warn('Вспышка недоступна:', e);
    }
  };

  return (
    <div className="native-scanner-overlay">
      {/* Верхняя панель: закрыть и фонарик */}
      <div className="scanner-header-bar">
        <button className="scanner-btn" onClick={onClose}>
          ✕ Закрыть
        </button>
        <button 
          className={`scanner-btn ${torch ? 'scanner-btn-active' : ''}`} 
          onClick={toggleFlashlight}
        >
          {torch ? 'Фонарик: ВКЛ' : 'Фонарик: ВЫКЛ'}
        </button>
      </div>

      {/* Центральный прицел (окно видоискателя) */}
      <div className="scanner-viewfinder"></div>

      {/* Нижняя информационная панель */}
      <div className="scanner-footer-bar">
        <div className="scanner-tip-bubble">
          {lastScanned ? `Отсканирован: ${lastScanned}` : 'Наведите прицел на штрихкод'}
        </div>
      </div>
    </div>
  );
};

export default Scanner;
