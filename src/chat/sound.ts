export type BeepKind = "message" | "knock";

/** One note of a beep: when it starts and how long it lasts, in seconds. */
export interface Note {
  frequency: number;
  start: number;
  duration: number;
}

/** What each beep is made of. Generated, so there is nothing to download. */
export const BEEPS: Readonly<Record<BeepKind, readonly Note[]>> = {
  message: [
    { frequency: 880, start: 0, duration: 0.09 },
    { frequency: 1320, start: 0.1, duration: 0.14 },
  ],
  knock: [
    { frequency: 330, start: 0, duration: 0.06 },
    { frequency: 330, start: 0.14, duration: 0.06 },
    { frequency: 330, start: 0.28, duration: 0.06 },
  ],
};

const VOLUME = 0.12;

/** How long a beep lasts from start to end, in seconds. */
export function beepLength(kind: BeepKind): number {
  return Math.max(...BEEPS[kind].map((n) => n.start + n.duration));
}

let context: AudioContext | null = null;

/** Plays a beep. It does nothing, quietly, where the browser has no sound or has not allowed it yet. */
export function playBeep(kind: BeepKind): void {
  try {
    context ??= new AudioContext();
    const audio = context;
    void audio.resume();
    const now = audio.currentTime;
    for (const note of BEEPS[kind]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = now + note.start;
      const end = start + note.duration;
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(VOLUME, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  } catch {
    // no sound is not a problem
  }
}
