/**
 * Короткий звук при входящем сообщении (Web Audio API, без файлов).
 * Если контекст в suspended (до первого жеста пользователя), делается resume — может не сработать до клика на странице.
 */
let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const AC =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    return null;
  }
  if (!sharedCtx || sharedCtx.state === 'closed') {
    try {
      sharedCtx = new AC();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

function beep(ctx: AudioContext): void {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.setValueAtTime(660, t0 + 0.07);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.1, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
  osc.start(t0);
  osc.stop(t0 + 0.24);
}

export function playIncomingMessageSound(): void {
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  const play = () => {
    try {
      beep(ctx);
    } catch {
      // игнорируем ограничения браузера / сбои движка
    }
  };
  if (ctx.state === 'suspended') {
    void ctx.resume().then(play).catch(() => {});
    return;
  }
  play();
}
