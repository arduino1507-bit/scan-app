import React from 'react';

interface FormattedBarcodeProps {
  code: string;
  className?: string;
  highlightCount?: number;
}

/**
 * Renders a barcode strictly on a single line (nowrap) with responsive sizing
 * so that any standard code (e.g. 13-digit EAN, 14-digit ITF, Code 128) fits seamlessly.
 * Highlights the last 4 characters in an amber/gold color.
 */
export const FormattedBarcode: React.FC<FormattedBarcodeProps> = ({
  code,
  className = '',
  highlightCount = 4,
}) => {
  const trimmed = code.trim();
  const len = trimmed.length;

  if (len <= highlightCount) {
    return (
      <span className={`font-mono font-bold whitespace-nowrap select-all ${className}`}>
        <span className="text-amber-400 underline decoration-amber-500/50 underline-offset-2">
          {trimmed}
        </span>
      </span>
    );
  }

  const prefix = trimmed.slice(0, len - highlightCount);
  const suffix = trimmed.slice(len - highlightCount);

  return (
    <span
      className={`font-mono whitespace-nowrap inline-flex items-baseline select-all tracking-tight ${className}`}
    >
      <span className="text-emerald-300 font-bold">{prefix}</span>
      <span className="text-amber-300 font-black bg-amber-400/15 px-1 py-0.2 rounded border border-amber-400/40 ml-0.5 shadow-xs">
        {suffix}
      </span>
    </span>
  );
};
