/** Averages a window of frames, and remembers the worst single frame in it. */
const WINDOW_SECONDS = 0.5;

export class FpsMeter {
  /** Frames per second over the last full window (0 until one completes). */
  fps = 0;
  /** The longest frame of the last full window, in milliseconds. */
  worstFrameMs = 0;

  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  tick(frameSeconds: number) {
    this.frames++;
    this.elapsed += frameSeconds;
    this.worst = Math.max(this.worst, frameSeconds * 1000);

    if (this.elapsed >= WINDOW_SECONDS) {
      this.fps = this.frames / this.elapsed;
      this.worstFrameMs = this.worst;
      this.frames = 0;
      this.elapsed = 0;
      this.worst = 0;
    }
  }
}
