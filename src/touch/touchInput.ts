import { joystickVector, STICK_RADIUS, type StickVector } from "./joystick";

/** A touch that lasts less than this (ms) and barely moves is a tap. */
export const TAP_MAX_MS = 300;
/** A touch that goes further than this (px) from where it began is a drag, not a tap. */
export const TAP_SLOP = 10;

export type TouchRole = "stick" | "look";

export interface Point {
  x: number;
  y: number;
}

/** What the game reads from fingers, every frame. */
export interface TouchSource {
  /** False while something covers the scene: nothing is read then. */
  readonly enabled: boolean;
  /** Where the joystick asks to go. */
  intent(): StickVector;
  /** How far (px) the look finger moved since the last read; reading starts it again from zero. */
  takeLook(): { dx: number; dy: number };
  /** A quick touch on the scene since the last read: where it was (client px). */
  takeTap(): Point | null;
}

interface Stick {
  id: number;
  origin: Point;
  at: Point;
}

interface Look {
  id: number;
  start: Point;
  last: Point;
  startedAt: number;
  dragged: boolean;
}

const NO_LOOK = { dx: 0, dy: 0 } as const;
const STILL: StickVector = { forward: 0, strafe: 0, run: false };

/**
 * What fingers on a touch screen mean, with nothing of the page in it: one
 * finger on the joystick walks, one finger on the scene turns the view, and a
 * quick touch on the scene is a tap. Each finger is followed by its own id, so
 * the two thumbs never mix, and a second finger on a thing already held is
 * ignored. The screen turns events into calls on this, and the game reads it.
 */
export class TouchInput implements TouchSource {
  private active = true;
  private stick: Stick | null = null;
  private look: Look | null = null;
  private lookDx = 0;
  private lookDy = 0;
  private tap: Point | null = null;

  get enabled(): boolean {
    return this.active;
  }

  /** Turns the reading on or off. Off, every finger is let go of: nothing keeps walking or turning behind a menu. */
  setEnabled(enabled: boolean) {
    if (enabled === this.active) return;
    this.active = enabled;
    if (!enabled) this.reset();
  }

  /** Lets go of every finger (the page was hidden, or the touches were taken away) without turning the reading off. */
  cancelAll() {
    this.reset();
  }

  /**
   * A finger went down. `origin` is where the middle of the joystick is, when
   * the finger is on one; false when the finger is not taken (the reading is
   * off, or that thing already has a finger).
   */
  begin(
    role: TouchRole,
    id: number,
    x: number,
    y: number,
    now: number,
    origin: Point = { x, y },
  ): boolean {
    if (!this.active) return false;
    if (role === "stick") {
      if (this.stick) return false;
      this.stick = { id, origin: { ...origin }, at: { x, y } };
      return true;
    }
    if (this.look) return false;
    this.look = {
      id,
      start: { x, y },
      last: { x, y },
      startedAt: now,
      dragged: false,
    };
    return true;
  }

  move(id: number, x: number, y: number) {
    const { stick, look } = this;
    if (stick?.id === id) {
      stick.at = { x, y };
    } else if (look?.id === id) {
      this.lookDx += x - look.last.x;
      this.lookDy += y - look.last.y;
      look.last = { x, y };
      if (Math.hypot(x - look.start.x, y - look.start.y) > TAP_SLOP)
        look.dragged = true;
    }
  }

  /** The finger lifted, at (x, y). */
  end(id: number, x: number, y: number, now: number) {
    if (this.stick?.id === id) {
      this.stick = null;
      return;
    }
    const look = this.look;
    if (look?.id !== id) return;
    this.look = null;
    const quick = now - look.startedAt <= TAP_MAX_MS;
    const still =
      !look.dragged &&
      Math.hypot(x - look.start.x, y - look.start.y) <= TAP_SLOP;
    if (quick && still) this.tap = { x, y };
  }

  /** The system took the touch away (a call, a gesture of the browser): it is not a tap. */
  cancel(id: number) {
    if (this.stick?.id === id) this.stick = null;
    else if (this.look?.id === id) this.look = null;
  }

  intent(): StickVector {
    const stick = this.stick;
    if (!stick) return STILL;
    return joystickVector(
      stick.at.x - stick.origin.x,
      stick.at.y - stick.origin.y,
    );
  }

  /** Where the thumb is from the middle of the joystick, held inside its base; null with no finger on it. */
  stickOffset(): Point | null {
    const stick = this.stick;
    if (!stick) return null;
    const dx = stick.at.x - stick.origin.x;
    const dy = stick.at.y - stick.origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= STICK_RADIUS) return { x: dx, y: dy };
    const scale = STICK_RADIUS / distance;
    return { x: dx * scale, y: dy * scale };
  }

  takeLook(): { dx: number; dy: number } {
    if (this.lookDx === 0 && this.lookDy === 0) return { ...NO_LOOK };
    const taken = { dx: this.lookDx, dy: this.lookDy };
    this.lookDx = 0;
    this.lookDy = 0;
    return taken;
  }

  takeTap(): Point | null {
    const tap = this.tap;
    this.tap = null;
    return tap;
  }

  private reset() {
    this.stick = null;
    this.look = null;
    this.lookDx = 0;
    this.lookDy = 0;
    this.tap = null;
  }
}
