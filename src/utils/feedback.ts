// Audio and haptics helper for barcode scanning

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a clear, pleasant pos-scanner confirmation beep
 */
export function playSuccessBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(1760, now); // A6 note
    osc.frequency.exponentialRampToValueAtTime(2349.32, now + 0.08); // D7 note

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.17);
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Plays a distinctive low warning double-beep for duplicate codes
 */
export function playDuplicateWarningBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(330, now + 0.1); // E4 lower

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    console.warn('Audio warning failed:', e);
  }
}

/**
 * Plays a rejected/error buzz sound for mask mismatch
 */
export function playMaskMismatchBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(220, now); // A3 low buzz
    osc.frequency.setValueAtTime(196, now + 0.08); // G3

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  } catch (e) {
    console.warn('Audio mask warning failed:', e);
  }
}

/**
 * Triggers hardware vibration on Android devices
 */
export function triggerHaptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 80]);
    }
  } catch (e) {
    console.warn('Haptic vibration failed:', e);
  }
}

/**
 * Warning vibration (2 quick bursts)
 */
export function triggerWarningHaptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch (e) {
    console.warn('Haptic warning failed:', e);
  }
}

export function playFeedback() {
  playSuccessBeep();
  triggerHaptic();
}

export function playDuplicateFeedback() {
  playDuplicateWarningBeep();
  triggerWarningHaptic();
}

export function playMaskMismatchFeedback() {
  playMaskMismatchBeep();
  triggerWarningHaptic();
}
