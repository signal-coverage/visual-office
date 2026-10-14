import type { FloorPreview, PreviewRect } from "../../shared/floorPreview.ts";

type Request = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_RECTS = 400;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const rectsOf = (value: unknown): PreviewRect[] =>
  Array.isArray(value)
    ? value
        .filter(
          (rect): rect is [number, number, number, number] =>
            Array.isArray(rect) &&
            rect.length === 4 &&
            rect.every((n) => typeof n === "number" && Number.isFinite(n)),
        )
        .slice(0, MAX_RECTS)
        .map(([a, b, c, d]) => [a, b, c, d] as const)
    : [];

function previewOf(value: unknown): FloorPreview | null {
  if (!isRecord(value)) return null;
  const { id, width, depth } = value;
  if (
    typeof id !== "string" ||
    typeof width !== "number" ||
    typeof depth !== "number" ||
    !(width > 0) ||
    !(depth > 0)
  )
    return null;
  return {
    id,
    width,
    depth,
    walls: rectsOf(value.walls),
    glass: rectsOf(value.glass),
    zones: rectsOf(value.zones),
    items: rectsOf(value.items),
  };
}

/** The plans from the server's answer, leaving out whatever is malformed; null when it is not an answer of plans. */
export function parsePreviews(body: unknown): FloorPreview[] | null {
  if (!isRecord(body) || !Array.isArray(body.previews)) return null;
  return body.previews.flatMap((entry) => previewOf(entry) ?? []);
}

/** The plan of every room, or null when the server would not say. */
export async function fetchPreviews(
  request: Request,
  serverBase: string,
): Promise<FloorPreview[] | null> {
  try {
    const response = await request(`${serverBase}/account/floors/previews`);
    if (!response.ok) return null;
    return parsePreviews(await response.json());
  } catch {
    return null;
  }
}
