type Unpatch = () => void;

let originalPlay: ((this: HTMLAudioElement, ...args: any[]) => Promise<void>) | null = null;

export const installAudioGuard = (): Unpatch => {
  if (typeof window === 'undefined' || !('HTMLAudioElement' in window)) return () => {};
  if (originalPlay) return () => { /* already installed */ };
  originalPlay = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function (...args: any[]) {
    try {
      // if global mute is set by localStorage key used by soundService, don't play
      const v = window.localStorage.getItem('meem_sound_muted_v1');
      if (v === '1') {
        return Promise.resolve();
      }
    } catch (e) {
      // ignore
    }
    return originalPlay!.apply(this, args);
  } as any;
  return () => {
    if (originalPlay) {
      HTMLAudioElement.prototype.play = originalPlay as any;
      originalPlay = null;
    }
  };
};

export default installAudioGuard;
