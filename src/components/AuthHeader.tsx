import React from 'react';

interface AuthBannerProps {
  userEmail?: string | null;
  userName?: string | null;
  photoURL?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoading: boolean;
}

export const AuthHeader: React.FC<AuthBannerProps> = ({
  userEmail,
  userName,
  photoURL,
  onLogin,
  onLogout,
  isLoading,
}) => {
  if (userEmail) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {photoURL ? (
            <img
              src={photoURL}
              alt={userName || 'User'}
              className="w-7 h-7 rounded-full border border-emerald-500/50 object-cover shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
              {(userName || userEmail)[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-slate-200 truncate leading-tight">
              {userName || 'Google Акаунт'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{userEmail}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-slate-700 transition-colors font-medium"
        >
          Вийти
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-emerald-950/60 to-slate-900 border-b border-emerald-500/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-lg mx-auto">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Вхід через Google Акаунт
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Потрібно для автоматичної синхронізації в таблицю <strong>Scan</strong>
          </p>
        </div>

        {/* Official-styled Google Sign In button */}
        <button
          onClick={onLogin}
          disabled={isLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>{isLoading ? 'Підключення...' : 'Увійти через Google'}</span>
        </button>
      </div>
    </div>
  );
};
