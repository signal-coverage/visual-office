import { MAX_POINTS_PER_MESSAGE, type Point } from "../../shared/drawing.ts";

/** One piece of line to draw: from the previous point (null: a lone dot) to this one. */
export interface Segment {
  from: Point | null;
  to: Point;
}

/**
 * Turns the points of strokes, which arrive a few at a time, into the pieces
 * of line to draw. It remembers where each stroke left off, so the pieces join
 * up across messages and a stroke never connects to a different one.
 */
export class StrokeTracker {
  private readonly last = new Map<string, Point>();

  advance(strokeId: string, points: Point[]): Segment[] {
    const segments: Segment[] = [];
    let from = this.last.get(strokeId) ?? null;
    for (const to of points) {
      segments.push({ from, to });
      from = to;
    }
    if (from) this.last.set(strokeId, from);
    return segments;
  }

  /** Forget every stroke, e.g. because the board was cleared. */
  reset(): void {
    this.last.clear();
  }
}

/** The smallest movement (as a fraction of the board) worth recording. */
const MIN_STEP = 0.002;

/**
 * The points of the stroke being drawn, waiting to be sent. Points that barely
 * moved are skipped, and what is taken comes out in message-sized pieces.
 */
export class StrokeBuffer {
  private readonly queue: Point[] = [];
  private lastKept: Point | null = null;

  get pending(): number {
    return this.queue.length;
  }

  /** Records a point unless it is too close to the last one. Returns whether it was kept. */
  add(point: Point): boolean {
    const last = this.lastKept;
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_STEP)
      return false;
    this.lastKept = point;
    this.queue.push(point);
    return true;
  }

  /** Removes and returns up to one message's worth of points, oldest first. */
  take(): Point[] {
    return this.queue.splice(0, MAX_POINTS_PER_MESSAGE);
  }
}
