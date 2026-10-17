import type { Box } from "../../shared/collision.ts";
import {
  CATALOG,
  furnitureExtent,
  isFlat,
  piecesOf,
  type Furniture,
} from "../../shared/furniture.ts";
import type { Target } from "../../shared/officeProblems.ts";
import { footprintCollider, type PropPlacement } from "../../shared/props.ts";
import {
  shellFloorBox,
  type Shell,
  type ShellRef,
} from "../../shared/shell.ts";
import { css, fillBox, label, outlineBoxes } from "./canvas";
import { drawDraft, drawShell, type Draft } from "./drawShell";
import { SCALE, viewOf, type View } from "./view";

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
  /** The structure mode: the shell can be edited and the furniture is shown dimmed. */
  structure?: {
    selected: ShellRef | null;
    /** Parts of the shell with a problem, as `kind:index`. */
    flagged: ReadonlySet<string>;
    draft: Draft | null;
  };
}

export const targetKey = (target: Target) => `${target.list}:${target.index}`;

function drawGrid(ctx: CanvasRenderingContext2D, view: View, floor: Box) {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = 1;
  for (let x = Math.ceil(floor.minX); x <= floor.maxX; x++) {
    const [sx, top] = view.worldToScreen(x, floor.minZ);
    const [, bottom] = view.worldToScreen(x, floor.maxZ);
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bottom);
    ctx.stroke();
  }
  for (let z = Math.ceil(floor.minZ); z <= floor.maxZ; z++) {
    const [left, sy] = view.worldToScreen(floor.minX, z);
    const [right] = view.worldToScreen(floor.maxX, z);
    ctx.beginPath();
    ctx.moveTo(left, sy);
    ctx.lineTo(right, sy);
    ctx.stroke();
  }
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  view: View,
  item: Furniture,
  alpha: number,
  named = true,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (item.kind === "plant") {
    const [sx, sy] = view.worldToScreen(item.x, item.z);
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
        outlineBoxes(ctx, view, [box], "#c9a400", 1.5, [4, 3]);
      } else {
        ctx.globalAlpha = alpha * (piece.solid ? 0.95 : 0.55);
        fillBox(ctx, view, box, css(piece.color));
      }
    }
  }
  ctx.restore();

  if (
    named &&
    !isFlat(item.kind) &&
    item.kind !== "light" &&
    item.kind !== "poster"
  ) {
    // Name it, when it is big enough on the plan to hold the word
    const wide =
      Math.max(...furnitureExtent(item).map((b) => b.maxX - b.minX)) * SCALE;
    if (wide > 36)
      label(
        ctx,
        view,
        CATALOG[item.kind].label,
        item.x,
        item.z,
        "rgba(255,255,255,0.95)",
      );
  }
}

function drawModel(
  ctx: CanvasRenderingContext2D,
  view: View,
  prop: PropPlacement,
  alpha: number,
  named = true,
) {
  const box = footprintCollider(prop);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (box) {
    fillBox(ctx, view, box, "rgba(200, 120, 40, 0.35)");
    outlineBoxes(ctx, view, [box], "#c87828", 1.5, [5, 3]);
  } else {
    const [sx, sy] = view.worldToScreen(prop.at[0], prop.at[1]);
    ctx.strokeStyle = "#c87828";
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy);
    ctx.lineTo(sx + 6, sy);
    ctx.moveTo(sx, sy - 6);
    ctx.lineTo(sx, sy + 6);
    ctx.stroke();
  }
  ctx.restore();
  if (named)
    label(
      ctx,
      view,
      prop.model.replace(/\.glb$/, ""),
      prop.at[0],
      prop.at[1],
      "#7a4510",
    );
}

/** How much of the furniture shows through while the structure is edited. */
const DIMMED = 0.3;

/** The whole plan of a floor: the shell, then everything placed, then the selection and any problems. */
export function drawPlan(
  ctx: CanvasRenderingContext2D,
  data: PlanData,
  ui: PlanUi,
  shell: Shell,
) {
  const view = viewOf(shell);
  const structure = ui.structure;
  ctx.clearRect(0, 0, view.canvasWidth, view.canvasHeight);
  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(0, 0, view.canvasWidth, view.canvasHeight);
  const floor = shellFloorBox(shell);
  fillBox(ctx, view, floor, "#e6e6ec");
  drawGrid(ctx, view, floor);

  // The furniture goes under the shell while the structure is what is edited, so it is the walls that are easy to reach
  const alpha = structure ? DIMMED : 1;
  const furniture = () => {
    // Floor decals first, so everything stands on top of them
    for (const flat of [true, false]) {
      data.furniture.forEach((item) => {
        if (isFlat(item.kind) === flat)
          drawFurniture(ctx, view, item, alpha, !structure);
      });
    }
    data.models.forEach((prop) =>
      drawModel(ctx, view, prop, alpha, !structure),
    );
  };
  if (structure) furniture();
  drawShell(ctx, view, shell, {
    detailed: structure !== undefined,
    structure: structure?.selected ?? null,
    flagged: structure?.flagged ?? new Set(),
    draft: null,
  });
  if (!structure) furniture();

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
      outlineBoxes(ctx, view, extentOf(target), "#e03131", 2.5);
  }
  if (!structure && ui.selected && extentOf(ui.selected).length)
    outlineBoxes(ctx, view, extentOf(ui.selected), "#1c7ed6", 2.5);

  if (ui.ghost?.kind === "furniture")
    drawFurniture(ctx, view, ui.ghost.item, 0.55);
  if (ui.ghost?.kind === "model") drawModel(ctx, view, ui.ghost.prop, 0.55);
  if (structure?.draft) drawDraft(ctx, view, structure.draft);
}
