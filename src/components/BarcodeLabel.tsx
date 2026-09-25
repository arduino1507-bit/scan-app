import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export type LabelPrintMode = 'both' | 'barcode_only' | 'text_only';

interface BarcodeLabelProps {
  code: string;
  className?: string;
  height?: number;
  width?: number;
  fontSize?: number;
  mode?: LabelPrintMode;
}

/**
 * Barcode label component supporting 3 modes:
 * 1. 'both': Barcode stripes + serial number decoding
 * 2. 'barcode_only': Only barcode stripes
 * 3. 'text_only': Only serial number
 * Font size and width are calibrated to fit nicely within standard 30-50mm thermal labels without overflow.
 */
export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  code,
  className = '',
  height = 42,
  width = 1.6,
  fontSize = 17, // Optimized size so numbers fit perfectly across thermal sticker width
  mode = 'both',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cleanCode = code.trim();

  useEffect(() => {
    if (mode === 'text_only') return;
    if (!svgRef.current) return;

    try {
      let format = 'CODE128';
      if (/^\d{13}$/.test(cleanCode)) {
        format = 'EAN13';
      } else if (/^\d{12}$/.test(cleanCode)) {
        format = 'UPC';
      } else if (/^\d{8}$/.test(cleanCode)) {
        format = 'EAN8';
      }

      JsBarcode(svgRef.current, cleanCode, {
        format,
        lineColor: '#000000',
        width,
        height,
        displayValue: false, // We control the text placement explicitly
        margin: 2,
        background: '#ffffff',
      });
    } catch {
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, cleanCode, {
            format: 'CODE128',
            lineColor: '#000000',
            width: 1.4,
            height,
            displayValue: false,
            margin: 2,
            background: '#ffffff',
          });
        }
      } catch (err) {
        console.warn('Barcode render error:', err);
      }
    }
  }, [cleanCode, height, width, mode]);

  return (
    <div
      className={`bg-white text-black p-2.5 rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center select-all max-w-full overflow-hidden ${className}`}
    >
      {/* 1. Barcode graphic (rendered if mode is 'both' or 'barcode_only') */}
      {mode !== 'text_only' && (
        <div className="w-full flex items-center justify-center overflow-hidden">
          <svg ref={svgRef} className="max-w-full h-auto" />
        </div>
      )}

      {/* 2. Serial number / text decoding (rendered if mode is 'both' or 'text_only') */}
      {mode !== 'barcode_only' && (
        <div
          className={`font-mono font-bold text-black text-center select-all whitespace-nowrap overflow-hidden tracking-normal ${
            mode === 'text_only' ? 'py-3 text-lg font-black' : 'mt-1.5 leading-none'
          }`}
          style={{ fontSize: `${mode === 'text_only' ? Math.max(fontSize, 18) : fontSize}px` }}
        >
          {cleanCode}
        </div>
      )}
    </div>
  );
};
