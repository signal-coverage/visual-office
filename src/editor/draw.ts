import { BOARDS } from "../../shared/boards.ts";
import type { Box } from "../../shared/collision.ts";
import {
  CATALOG,
  furnitureExtent,
  isFlat,
  piecesOf,
  type Furniture,
} from "../../shared/furniture.ts";
import { OFFICE_FLOOR, SHELL_COLLIDERS } from "../../shared/layout.ts";
import type { Target } from "../../shared/officeProblems.ts";
import { footprintCollider, type PropPlacement } from "../../shared/props.ts";
import { SCREENS } from "../../shared/screens.ts";
import { SPAWN_AREA } from "../../shared/spawn.ts";
import { ZONES } from "../../shared/zones.ts";
import { CANVAS_HEIGHT, CANVAS_WIDTH, SCALE, worldToScreen } from "./view";

export interface PlanData {
  furniture: Furniture[];
  models: PropPlacement[];
}

/** Something about to be put down, shown under the cursor. */
export type Ghost =
  | { kind: "furniture"; item: Furniture }
  | { kind: "model"; prop: PropPlacement };

export interface PlanUi {
  selected: Target | null;
  /** Things with a problem, as `list:index`, to outline in red. */
  flagged: ReadonlySet<string>;
  ghost: Ghost | null;
}

export const targetKey = (target: Target) => `${target.list}:${target.index}`;

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

function rect(box: Box): [number, number, number, number] {
  const [x0, y0] = worldToScreen(box.minX, box.minZ);
  const [x1, y1] = worldToScreen(box.maxX, box.maxZ);
  return [x0, y0, x1 - x0, y1 - y0];
}

function fillBox(ctx: CanvasRenderingContext2D, box: Box, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(...rect(box));
}

function outlineBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: Box[],
  color: string,
  width: number,
  dash: number[] = [],
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  for (const box of boxes) ctx.strokeRect(...rect(box));
  ctx.restore();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  z: number,
  color = "#222",
) {
  const [sx, sy] = worldToScreen(x, z);
  ctx.fillStyle = color;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, sx, sy);
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = 1;
  for (let x = Math.ceil(OFFICE_FLOOR.minX); x <= OFFICE_FLOOR.maxX; x++) {
    const [sx, top] = worldToScreen(x, OFFICE_FLOOR.minZ);
    const [, bottom] = worldToScreen(x, OFFICE_FLOOR.maxZ);
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bottom);
    ctx.stroke();
  }
  for (let z = Math.ceil(OFFICE_FLOOR.minZ); z <= OFFICE_FLOOR.maxZ; z++) {
    const [left, sy] = worldToScreen(OFFICE_FLOOR.minX, z);
    const [right] = worldToScreen(OFFICE_FLOOR.maxX, z);
    ctx.beginPath();
    ctx.moveTo(left, sy);
    ctx.lineTo(right, sy);
    ctx.stroke();
  }
}

/** The things that are fixed: the zones, where people appear, the walls, the whiteboard and the screen. */
function drawShell(ctx: CanvasRenderingContext2D) {
  for (const zone of ZONES) {
    fillBox(ctx, zone.area, "rgba(60, 160, 100, 0.12)");
    // At the bottom, where the meeting room's screen and table do not get in the way
    label(
      ctx,
      zone.label,
      (zone.area.minX + zone.area.maxX) / 2,
      zone.area.maxZ - 0.4,
      "#3a7d57",
    );
  }
  fillBox(ctx, SPAWN_AREA, "rgba(80, 120, 220, 0.14)");
  label(
    ctx,
    "People appear here",
    (SPAWN_AREA.minX + SPAWN_AREA.maxX) / 2,
    SPAWN_AREA.minZ + 0.35,
    "#4a64b8",
  );

  for (const wall of SHELL_COLLIDERS) fillBox(ctx, wall, "#4b4f5c");

  // The whiteboard and the screen hang on walls: a thick line along them
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const board of BOARDS) {
    ctx.strokeStyle = "#e0a030";
    const half = board.width / 2;
    const [ax, ay] = worldToScreen(
      board.center.x - board.right.x * half,
      board.center.z - board.right.z * half,
    );
    const [bx, by] = worldToScreen(
      board.center.x + board.right.x * half,
      board.center.z + board.right.z * half,
    );
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  for (const screen of SCREENS) {
    ctx.strokeStyle = "#8a52d6";
    const half = screen.width / 2;
    const [ax, ay] = worldToScreen(screen.center.x - half, screen.center.z);
    const [bx, by] = worldToScreen(screen.center.x + half, screen.center.z);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    label(
      ctx,
      "Screen",
      screen.center.x,
      screen.center.z + screen.normal.z * 0.45,
      "#6a3db0",
    );
  }
  ctx.restore();
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  item: Furniture,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (item.kind === "plant") {
    const [sx, sy] = worldToScreen(item.x, item.z);
    ctx.fillStyle = "#3f8f4f";
    ctx.beginPath();
    ctx.arc(sx, sy, 0.25 * SCALE, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const piece of piecesOf(item)) {
      const box = {
        minX: piece.at[0] - piece.size[0] / 2,
        maxX: piece.at[0] + piece.size[0] / 2,
        minZ: piece.at[2] - piece.size[2] / 2,
        maxZ: piece.at[2] + piece.size[2] / 2,
      };
      if (piece.emissive !== undefined) {
        // A ceiling light: only its outline, so what is under it stays visible
        outlineBoxes(ctx, [box], "#c9a400", 1.5, [4, 3]);
      } else {
        ctx.globalAlpha = alpha * (piece.solid ? 0.95 : 0.55);
        fillBox(ctx, box, css(piece.color));
      }
    }
  }
  ctx.restore();

  if (!isFlat(item.kind) && item.kind !== "light" && item.kind !== "poster") {
    // Name it, when it is big enough on the plan to hold the word
    const wide =
      Math.max(...furnitureExtent(item).map((b) => b.maxX - b.minX)) * SCALE;
    if (wide > 36)
      label(
        ctx,
        CATALOG[item.kind].label,
        item.x,
        item.z,
        "rgba(255,255,255,0.95)",
      );
  }
}

function drawModel(
  ctx: CanvasRenderingContext2D,
  prop: PropPlacement,
  alpha: number,
) {
  const box = footprintCollider(prop);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (box) {
    fillBox(ctx, box, "rgba(200, 120, 40, 0.35)");
    outlineBoxes(ctx, [box], "#c87828", 1.5, [5, 3]);
  } else {
    const [sx, sy] = worldToScreen(prop.at[0], prop.at[1]);
    ctx.strokeStyle = "#c87828";
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy);
    ctx.lineTo(sx + 6, sy);
    ctx.moveTo(sx, sy - 6);
    ctx.lineTo(sx, sy + 6);
    ctx.stroke();
  }
  ctx.restore();
  label(
    ctx,
    prop.model.replace(/\.glb$/, ""),
    prop.at[0],
    prop.at[1],
    "#7a4510",
  );
}

/** The whole plan: the fixed parts, then everything placed, then the selection and any problems. */
export function drawPlan(
  ctx: CanvasRenderingContext2D,
  data: PlanData,
  ui: PlanUi,
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  fillBox(ctx, OFFICE_FLOOR, "#e6e6ec");
  drawGrid(ctx);
  drawShell(ctx);

  // Floor decals first, so everything stands on top of them
  for (const flat of [true, false]) {
    data.furniture.forEach((item) => {
      if (isFlat(item.kind) === flat) drawFurniture(ctx, item, 1);
    });
  }
  data.models.forEach((prop) => drawModel(ctx, prop, 1));

  const extentOf = (target: Target): Box[] =>
    target.list === "furniture"
      ? furnitureExtent(data.furniture[target.index])
      : [footprintCollider(data.models[target.index])].flatMap((b) =>
          b ? [b] : [],
        );

  for (const key of ui.flagged) {
    const [list, index] = key.split(":");
    const target: Target = {
      list: list as Target["list"],
      index: Number(index),
    };
    if (extentOf(target).length)
      outlineBoxes(ctx, extentOf(target), "#e03131", 2.5);
  }
  if (ui.selected && extentOf(ui.selected).length)
    outlineBoxes(ctx, extentOf(ui.selected), "#1c7ed6", 2.5);

  if (ui.ghost?.kind === "furniture") drawFurniture(ctx, ui.ghost.item, 0.55);
  if (ui.ghost?.kind === "model") drawModel(ctx, ui.ghost.prop, 0.55);
}
