import React, { useMemo } from 'react';

interface RandomBarcodeProps {
  className?: string;
}

export const RandomBarcodeHero: React.FC<RandomBarcodeProps> = ({
  className = '',
}) => {
  // Generate realistic barcode stripe widths (pure barcode graphics, compact size)
  const bars = useMemo(() => {
    return [
      3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 1, 4,
      2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 2
    ];
  }, []);

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-3.5 sm:p-4 bg-white rounded-2xl shadow-xl border border-emerald-400/40 select-none overflow-hidden max-w-[240px] mx-auto ${className}`}
    >
      {/* Decorative top subtle laser line */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 shadow-[0_0_10px_#34d399]" />

      {/* Pure Barcode Stripes without any numbers or labels */}
      <div className="flex items-end justify-center gap-[2px] h-14 sm:h-16 w-full px-2 py-0.5">
        {bars.map((width, idx) => (
          <div
            key={idx}
            className="bg-slate-950 rounded-xs"
            style={{
              width: `${width * 1.8}px`,
              height: idx % 6 === 0 || idx % 10 === 0 ? '100%' : '88%',
            }}
          />
        ))}
      </div>
    </div>
  );
};
