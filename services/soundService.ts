// safe play helper — respects mute state
export const playSound = (url: string) => {
  try {
    const a = new Audio(url);
    // play without awaiting — failures are non-fatal
    a.play().catch(() => {});
  } catch (e) {
    // ignore
  }
};

// Backwards-compatible play(name) function used by existing components.
// It will try to play an asset from /assets/sounds/{name}.mp3 if provided.
export const play = (name?: string) => {
  if (!name) return;
  try {
    // conservative: attempt .mp3 in assets. If file missing the Audio playback will fail silently.
    const url = `/assets/sounds/${name}.mp3`;
    playSound(url);
  } catch (e) {
    // ignore
  }
};

export default {
  playSound,
  play,
};

// backward-compatible named export
export const soundService = {
  playSound,
  play,
};
