import * as THREE from "three";
import {
  aimAtBoard,
  BOARDS,
  boardById,
  canReachBoard,
  type Vec3,
} from "../../shared/boards.ts";
import {
  INKS,
  type Point,
  type Stroke,
  type StrokeMessage,
} from "../../shared/drawing.ts";
import { BoardSurface } from "./BoardSurface";
import { StrokeBuffer } from "./strokes";

/** How the boards talk to the server. */
export interface BoardSender {
  draw: (message: StrokeMessage) => void;
  clear: (board: string) => void;
}

/** What the player is pointing at, for the on-screen hint. */
export interface BoardAim {
  board: string;
  ink: number;
}

/** Strokes are sent this many times a second while drawing. */
const SEND_INTERVAL = 1 / 15;
const CURSOR_RADIUS = 0.012;
/** The cursor floats a hair in front of the board so it is never hidden by it. */
const CURSOR_LIFT = 0.003;

interface ActiveStroke {
  board: string;
  id: number;
  ink: number;
  buffer: StrokeBuffer;
}

/**
 * Everything the player does with the boards: aim at one, draw on it, change
 * pen, clear it; and showing what others draw. Only the boards of the zone the
 * player is in are shown, and leaving the zone wipes them from this screen.
 */
export class Whiteboards {
  private readonly surfaces = new Map<string, BoardSurface>();
  private readonly cursor: THREE.Mesh;
  private readonly sender: BoardSender;
  private zone: string | null = null;
  private ink = 0;
  private nextStrokeId = 1;
  private active: ActiveStroke | null = null;
  private sinceSend = 0;
  private aimed: { board: string; point: Point; world: Vec3 } | null = null;

  constructor(scene: THREE.Scene, sender: BoardSender) {
    this.sender = sender;
    for (const board of BOARDS) {
      const surface = new BoardSurface(board);
      this.surfaces.set(board.id, surface);
      scene.add(surface.mesh);
    }
    this.cursor = new THREE.Mesh(
      new THREE.CircleGeometry(CURSOR_RADIUS, 16),
      new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false }),
    );
    this.cursor.renderOrder = 2;
    this.cursor.visible = false;
    scene.add(this.cursor);
  }

  get currentInk(): number {
    return this.ink;
  }

  setInk(ink: number): void {
    if (ink < 0 || ink >= INKS.length || ink === this.ink) return;
    this.finishStroke(); // a stroke has one colour from start to end
    this.ink = ink;
  }

  /** The player moved into a zone (or out of every zone): show only that zone's boards. */
  setZone(zone: string | null): void {
    this.finishStroke();
    this.zone = zone;
    for (const [id, surface] of this.surfaces) {
      if (boardById(id)?.zone !== zone) surface.clear();
    }
  }

  /** Somebody else's stroke. */
  applyStroke(message: {
    board: string;
    id: string;
    ink: number;
    points: Point[];
  }) {
    this.surfaces.get(message.board)?.apply(message);
  }

  clearBoard(board: string): void {
    this.surfaces.get(board)?.clear();
  }

  /** What the server already has on a board, when we walk into its zone. */
  showBoard(board: string, strokes: Stroke[]): void {
    this.surfaces.get(board)?.show(strokes);
  }

  /** Wipes the board the player is looking at, for everybody in the room. Returns whether there was one. */
  clearAimed(): boolean {
    if (!this.aimed) return false;
    const { board } = this.aimed;
    this.finishStroke();
    this.surfaces.get(board)?.clear();
    this.sender.clear(board);
    return true;
  }

  /**
   * Call every frame with where the player's eyes are and which way they look.
   * While `drawing` is true and a board is in reach, the pen follows the aim.
   * Returns what is being pointed at, or null.
   */
  update(
    dt: number,
    eye: Vec3,
    direction: Vec3,
    drawing: boolean,
  ): BoardAim | null {
    this.aimed = this.findAim(eye, direction);
    this.updateCursor();

    if (drawing && this.aimed) this.drawAt(this.aimed.board, this.aimed.point);
    else this.finishStroke();

    this.sinceSend += dt;
    if (this.active && this.sinceSend >= SEND_INTERVAL) this.flush();

    return this.aimed ? { board: this.aimed.board, ink: this.ink } : null;
  }

  dispose(): void {
    this.cursor.geometry.dispose();
    (this.cursor.material as THREE.Material).dispose();
    for (const surface of this.surfaces.values()) {
      surface.mesh.removeFromParent();
      surface.dispose();
    }
    this.cursor.removeFromParent();
  }

  private findAim(
    eye: Vec3,
    direction: Vec3,
  ): { board: string; point: Point; world: Vec3 } | null {
    for (const board of BOARDS) {
      if (board.zone !== this.zone || !canReachBoard(board, eye.x, eye.z))
        continue;
      const hit = aimAtBoard(board, eye, direction);
      if (!hit) continue;
      return {
        board: board.id,
        // On the board's picture y runs from the top down
        point: [hit.u, 1 - hit.v],
        world: {
          x:
            board.center.x +
            board.right.x * (hit.u - 0.5) * board.width +
            board.normal.x * CURSOR_LIFT,
          y: board.center.y + (hit.v - 0.5) * board.height,
          z:
            board.center.z +
            board.right.z * (hit.u - 0.5) * board.width +
            board.normal.z * CURSOR_LIFT,
        },
      };
    }
    return null;
  }

  private updateCursor(): void {
    const aim = this.aimed;
    this.cursor.visible = aim !== null;
    if (!aim) return;
    this.cursor.position.set(aim.world.x, aim.world.y, aim.world.z);
    const board = boardById(aim.board)!;
    this.cursor.rotation.y = Math.atan2(board.normal.x, board.normal.z);
    (this.cursor.material as THREE.MeshBasicMaterial).color.setHex(
      INKS[this.ink].color === 0xffffff ? 0xbbbbbb : INKS[this.ink].color,
    );
  }

  private drawAt(board: string, point: Point): void {
    if (this.active && this.active.board !== board) this.finishStroke();
    if (!this.active) {
      this.active = {
        board,
        id: this.nextStrokeId++,
        ink: this.ink,
        buffer: new StrokeBuffer(),
      };
    }
    if (!this.active.buffer.add(point)) return;
    // Show it at once on our own screen; the server only has to tell the others
    this.surfaces.get(board)?.apply({
      id: `local:${this.active.id}`,
      ink: this.active.ink,
      points: [point],
    });
  }

  private flush(): void {
    const stroke = this.active;
    if (!stroke) return;
    this.sinceSend = 0;
    for (
      let points = stroke.buffer.take();
      points.length;
      points = stroke.buffer.take()
    ) {
      this.sender.draw({
        board: stroke.board,
        id: stroke.id,
        ink: stroke.ink,
        points,
      });
    }
  }

  private finishStroke(): void {
    if (!this.active) return;
    this.flush();
    this.active = null;
  }
}
