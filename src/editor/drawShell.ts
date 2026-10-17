import type { Box } from "../../shared/collision.ts";
import { COLORS } from "../../shared/pieces.ts";
import {
  outerWalls,
  slabBox,
  type Shell,
  type ShellBoard,
  type ShellRef,
  type ShellScreen,
  type Slab,
} from "../../shared/shell.ts";
import { css, fillBox, label, outlineBoxes, rect } from "./canvas";
import type { Point } from "./shellEdit";
import { boundsOf, mountSegment, yawVector } from "./structureView";
import { SCALE, type View } from "./view";

/** What is being drawn with the mouse, shown while the button is down. */
export type Draft =
  | { kind: "slab"; glass: boolean; slab: Slab }
  | { kind: "rect"; rect: Box; text: string }
  | {
      kind: "mount";
      mount: ShellBoard | ShellScreen | null;
      screen: boolean;
      at: Point;
    };

export interface ShellUi {
  /** The structure mode: ids and sizes are shown and parts can be selected. */
  detailed: boolean;
  structure: ShellRef | null;
  /** Parts with a problem, as `kind:index`. */
  flagged: ReadonlySet<string>;
  draft: Draft | null;
}

const WALL = "#4b4f5c";
const GLASS_FILL = "rgba(120, 190, 230, 0.5)";
const GLASS_LINE = "#2f8fc0";
const ZONE = "#2f8a5a";
const AREA = "#6b7fa8";
const BOARD = "#e0a030";
const SCREEN = "#8a52d6";
const SPAWN = "#4a64b8";
const SELECT = "#1c7ed6";
const PROBLEM = "#e03131";

/** A small padlock: a private zone is locked to whoever is outside. */
function lock(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = ZONE;
  ctx.fillStyle = ZONE;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x + 5, y + 4, 3, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x, y + 4, 10, 7);
  ctx.restore();
}

/** A filled triangle at a point, pointing along `direction` (a unit vector on the screen). */
function arrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Point,
  size: number,
  color: string,
) {
  const [dx, dy] = direction;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + dx * size, y + dy * size);
  ctx.lineTo(
    x - dx * size * 0.4 - dy * size * 0.7,
    y - dy * size * 0.4 + dx * size * 0.7,
  );
  ctx.lineTo(
    x - dx * size * 0.4 + dy * size * 0.7,
    y - dy * size * 0.4 - dx * size * 0.7,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMount(
  ctx: CanvasRenderingContext2D,
  view: View,
  mount: ShellBoard | ShellScreen,
  color: string,
  text: string | null,
  alpha = 1,
) {
  const { a, b, out } = mountSegment(mount);
  const [ax, ay] = view.worldToScreen(a[0], a[1]);
  const [bx, by] = view.worldToScreen(b[0], b[1]);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  // The arrow out of the wall says which way it faces
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  arrowHead(ctx, mx + out[0] * 9, my + out[1] * 9, out, 6, color);
  ctx.restore();
  if (text)
    label(
      ctx,
      view,
      text,
      (a[0] + b[0]) / 2 + out[0] * 0.75,
      (a[1] + b[1]) / 2 + out[1] * 0.75,
      color,
    );
}

function drawSlab(
  ctx: CanvasRenderingContext2D,
  view: View,
  slab: Slab,
  glass: boolean,
  alpha = 1,
) {
  const box = slabBox(slab);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!glass) {
    fillBox(ctx, view, box, WALL);
  } else {
    fillBox(ctx, view, box, GLASS_FILL);
    outlineBoxes(ctx, view, [box], GLASS_LINE, 1.5);
    // A pale line down the middle: glass is something you see through
    const [x, y, w, h] = rect(view, box);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    if (w >= h) {
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
    } else {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
    }
    ctx.stroke();
  }
  ctx.restore();
}

const meters = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

const size = (box: Box) =>
  `${meters(box.maxX - box.minX)} × ${meters(box.maxZ - box.minZ)} m`;

/** The parts of a shell, drawn so each kind can be told from the others at a glance. */
export function drawShell(
  ctx: CanvasRenderingContext2D,
  view: View,
  shell: Shell,
  ui: ShellUi,
) {
  for (const patch of shell.floors) {
    fillBox(
      ctx,
      view,
      slabBox(patch),
      patch.tone === "meeting"
        ? `${css(COLORS.meetingFloor)}73`
        : `${css(COLORS.loungeFloor)}b3`,
    );
    if (ui.detailed)
      label(
        ctx,
        view,
        `Floor · ${patch.tone}`,
        patch.x,
        patch.z + patch.depth / 2 - 0.3,
        "#5b5f6e",
      );
  }

  for (const area of shell.areas) {
    fillBox(ctx, view, area.rect, "rgba(90, 110, 160, 0.05)");
    outlineBoxes(ctx, view, [area.rect], AREA, 1.5, [1.5, 4]);
    label(
      ctx,
      view,
      ui.detailed ? `${area.label} (area)` : area.label,
      area.rect.minX + 0.2,
      area.rect.minZ + 0.35,
      AREA,
      "left",
    );
  }

  for (const zone of shell.zones) {
    fillBox(ctx, view, zone.rect, "rgba(60, 160, 100, 0.12)");
    outlineBoxes(ctx, view, [zone.rect], ZONE, 2, [9, 5]);
    const [x, y] = view.worldToScreen(zone.rect.minX, zone.rect.minZ);
    lock(ctx, x + 6, y + 6);
    // At the bottom, where the room's screen and table do not get in the way
    label(
      ctx,
      view,
      ui.detailed ? `${zone.label} (${zone.id})` : zone.label,
      (zone.rect.minX + zone.rect.maxX) / 2,
      zone.rect.maxZ - 0.4,
      "#3a7d57",
    );
  }

  const spawn = shell.spawn.area;
  fillBox(ctx, view, spawn, "rgba(80, 120, 220, 0.14)");
  outlineBoxes(ctx, view, [spawn], SPAWN, 1.5);
  label(
    ctx,
    view,
    "People appear here",
    (spawn.minX + spawn.maxX) / 2,
    spawn.minZ + 0.35,
    SPAWN,
  );
  {
    const way = yawVector(shell.spawn.yaw);
    const [cx, cy] = view.worldToScreen(
      (spawn.minX + spawn.maxX) / 2,
      (spawn.minZ + spawn.maxZ) / 2 + 0.1,
    );
    ctx.save();
    ctx.strokeStyle = SPAWN;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - way.x * 12, cy - way.z * 12);
    ctx.lineTo(cx + way.x * 8, cy + way.z * 8);
    ctx.stroke();
    ctx.restore();
    arrowHead(ctx, cx + way.x * 12, cy + way.z * 12, [way.x, way.z], 7, SPAWN);
  }

  for (const wall of outerWalls(shell)) drawSlab(ctx, view, wall, false);
  for (const wall of shell.walls) drawSlab(ctx, view, wall, false);
  for (const wall of shell.glass) drawSlab(ctx, view, wall, true);

  for (const board of shell.boards)
    drawMount(ctx, view, board, BOARD, ui.detailed ? "Board" : null);
  for (const screen of shell.screens)
    drawMount(ctx, view, screen, SCREEN, "Screen");

  if (!ui.detailed) return;

  const outline = (ref: ShellRef, color: string, width: number) => {
    const box = boundsOf(shell, ref);
    if (box) outlineBoxes(ctx, view, [box], color, width);
  };
  for (const key of ui.flagged) {
    const [kind, index] = key.split(":");
    outline(
      { kind: kind as ShellRef["kind"], index: Number(index) },
      PROBLEM,
      2.5,
    );
  }
  if (ui.structure) outline(ui.structure, SELECT, 2.5);
}

/** What is being drawn right now, on top of everything. */
export function drawDraft(
  ctx: CanvasRenderingContext2D,
  view: View,
  draft: Draft,
) {
  if (draft.kind === "slab") {
    drawSlab(ctx, view, draft.slab, draft.glass, 0.65);
    outlineBoxes(ctx, view, [slabBox(draft.slab)], SELECT, 1.5, [5, 3]);
    label(
      ctx,
      view,
      size(slabBox(draft.slab)),
      draft.slab.x,
      draft.slab.z - draft.slab.depth / 2 - 0.4,
      SELECT,
    );
    return;
  }
  if (draft.kind === "rect") {
    fillBox(ctx, view, draft.rect, "rgba(28, 126, 214, 0.12)");
    outlineBoxes(ctx, view, [draft.rect], SELECT, 2, [6, 4]);
    label(
      ctx,
      view,
      `${draft.text} · ${size(draft.rect)}`,
      (draft.rect.minX + draft.rect.maxX) / 2,
      (draft.rect.minZ + draft.rect.maxZ) / 2,
      SELECT,
    );
    return;
  }
  if (draft.mount) {
    drawMount(ctx, view, draft.mount, draft.screen ? SCREEN : BOARD, null, 0.6);
    return;
  }
  const [x, y] = view.worldToScreen(draft.at[0], draft.at[1]);
  ctx.save();
  ctx.strokeStyle = PROBLEM;
  ctx.lineWidth = 2;
  const r = 0.18 * SCALE;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.restore();
}
