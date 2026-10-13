/** A pen colour, or the eraser, and how thick its line is (in pixels of the board's picture). */
export interface Ink {
  name: string;
  color: number;
  width: number;
}

export const INKS: readonly Ink[] = [
  { name: "Black", color: 0x111111, width: 5 },
  { name: "Red", color: 0xe03131, width: 5 },
  { name: "Blue", color: 0x1c7ed6, width: 5 },
  { name: "Green", color: 0x2f9e44, width: 5 },
  { name: "Orange", color: 0xf08c00, width: 5 },
  { name: "Purple", color: 0x9c36b5, width: 5 },
  // Erasing is drawing in the colour of the board, so it is stored and shared like any stroke
  { name: "Eraser", color: 0xffffff, width: 36 },
];
export const ERASER = INKS.length - 1;

/** What the server accepts, so one player cannot flood a board or the network. */
export const MAX_POINTS_PER_MESSAGE = 64;
export const MAX_POINTS_PER_STROKE = 4000;
export const MAX_POINTS_PER_BOARD = 60000;
const MAX_STROKE_NUMBER = 1_000_000;
const MAX_BOARD_ID_LENGTH = 32;

/** A point on a board: x from left to right and y from top to bottom, both 0..1. */
export type Point = [number, number];

/** A piece of a stroke sent by whoever is drawing it. */
export interface StrokeMessage {
  board: string;
  /** Numbers the strokes of one player; every piece of the same stroke repeats it. */
  id: number;
  ink: number;
  /** New points, to add after the ones sent before. */
  points: Point[];
}

/** A stroke as the board keeps it and as it is sent to everybody else. */
export interface Stroke {
  /** Unique on the board: the author and their number for it. */
  id: string;
  ink: number;
  points: Point[];
}

const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/** Checks a stroke piece from an untrusted client, keeping only the fields we know. */
export function sanitizeStrokeMessage(raw: unknown): StrokeMessage | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const { board, id, ink, points } = raw as Record<string, unknown>;

  if (typeof board !== "string" || !board || board.length > MAX_BOARD_ID_LENGTH)
    return null;
  if (
    typeof id !== "number" ||
    !Number.isInteger(id) ||
    id < 0 ||
    id > MAX_STROKE_NUMBER
  )
    return null;
  if (
    typeof ink !== "number" ||
    !Number.isInteger(ink) ||
    ink < 0 ||
    ink >= INKS.length
  )
    return null;
  if (
    !Array.isArray(points) ||
    points.length < 1 ||
    points.length > MAX_POINTS_PER_MESSAGE
  )
    return null;

  const clean: Point[] = [];
  for (const point of points) {
    if (
      !Array.isArray(point) ||
      !isCoordinate(point[0]) ||
      !isCoordinate(point[1])
    )
      return null;
    clean.push([point[0], point[1]]);
  }
  return { board, id, ink, points: clean };
}

/** What one board holds: every stroke drawn on it since it was last cleared. */
export class BoardStore {
  private readonly strokes = new Map<string, Stroke>();
  private total = 0;

  get totalPoints(): number {
    return this.total;
  }

  /**
   * Adds points to `author`'s stroke number `id` (starting it if it is new).
   * Returns what was actually accepted, which is less than was sent when a
   * limit was reached, or null when nothing fits.
   */
  append(
    author: string,
    piece: { id: number; ink: number; points: Point[] },
  ): Stroke | null {
    const key = `${author}:${piece.id}`;
    const existing = this.strokes.get(key);
    const room = Math.min(
      MAX_POINTS_PER_STROKE - (existing?.points.length ?? 0),
      MAX_POINTS_PER_BOARD - this.total,
    );
    const accepted = piece.points.slice(0, Math.max(0, room));
    if (accepted.length === 0) return null;

    const stroke = existing ?? { id: key, ink: piece.ink, points: [] };
    stroke.points.push(...accepted.map((p): Point => [p[0], p[1]]));
    this.strokes.set(key, stroke);
    this.total += accepted.length;
    return {
      id: key,
      ink: stroke.ink,
      points: accepted.map((p): Point => [p[0], p[1]]),
    };
  }

  clear(): void {
    this.strokes.clear();
    this.total = 0;
  }

  /** Everything on the board, as copies that can be changed or sent freely. */
  snapshot(): Stroke[] {
    return [...this.strokes.values()].map((s) => ({
      id: s.id,
      ink: s.ink,
      points: s.points.map((p): Point => [p[0], p[1]]),
    }));
  }
}
