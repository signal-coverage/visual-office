import * as THREE from "three";
import type { Board } from "../../shared/boards.ts";
import { INKS, type Stroke } from "../../shared/drawing.ts";
import { StrokeTracker } from "./strokes";

/** How sharp the writing is: pixels of the board's picture per meter of the board. */
const PIXELS_PER_METER = 500;
const PAPER = "#ffffff";

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * What is drawn on one board: a canvas that is also the picture shown on the
 * wall. Strokes are added piece by piece as they arrive.
 */
export class BoardSurface {
  readonly board: Board;
  /** The plane to put in the scene. */
  readonly mesh: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly tracker = new StrokeTracker();

  constructor(board: Board) {
    this.board = board;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(board.width * PIXELS_PER_METER);
    this.canvas.height = Math.round(board.height * PIXELS_PER_METER);
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.paintPaper();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(board.width, board.height),
      new THREE.MeshBasicMaterial({ map: this.texture }),
    );
    this.mesh.position.set(board.center.x, board.center.y, board.center.z);
    // A plane faces +z; turn it so that it faces along the board's normal
    this.mesh.rotation.y = Math.atan2(board.normal.x, board.normal.z);
  }

  /** Draws new points of a stroke, joining them to the ones drawn before. */
  apply(stroke: Pick<Stroke, "id" | "ink" | "points">): void {
    const ink = INKS[stroke.ink];
    if (!ink) return;
    const { width, height } = this.canvas;
    const { ctx } = this;
    ctx.strokeStyle = ctx.fillStyle = css(ink.color);
    ctx.lineWidth = ink.width;

    for (const { from, to } of this.tracker.advance(stroke.id, stroke.points)) {
      ctx.beginPath();
      if (from) {
        ctx.moveTo(from[0] * width, from[1] * height);
        ctx.lineTo(to[0] * width, to[1] * height);
        ctx.stroke();
      } else {
        ctx.arc(to[0] * width, to[1] * height, ink.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.texture.needsUpdate = true;
  }

  clear(): void {
    this.paintPaper();
    this.tracker.reset();
    this.texture.needsUpdate = true;
  }

  /** Replaces everything with these strokes (what the server has, when somebody walks in). */
  show(strokes: Stroke[]): void {
    this.clear();
    for (const stroke of strokes) this.apply(stroke);
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  private paintPaper(): void {
    this.ctx.fillStyle = PAPER;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
