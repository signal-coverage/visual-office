import type { AuditEntry } from "../../shared/audit.ts";

/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

export interface AuditPage {
  /** Newest first. */
  entries: AuditEntry[];
  /** Where the next, older page starts, or null when this was the last. */
  nextBefore: number | null;
}

/** How many entries each page brings. */
export const PAGE_SIZE = 50;

const isEntry = (value: unknown): value is AuditEntry => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  const text = (field: unknown) => typeof field === "string";
  const textOrNull = (field: unknown) => field === null || text(field);
  return (
    typeof entry.id === "number" &&
    typeof entry.at === "number" &&
    textOrNull(entry.actorUserId) &&
    text(entry.actorName) &&
    text(entry.action) &&
    textOrNull(entry.targetUserId) &&
    textOrNull(entry.targetName) &&
    textOrNull(entry.floor) &&
    typeof entry.detail === "object" &&
    entry.detail !== null &&
    !Array.isArray(entry.detail)
  );
};

/** A page of the activity log (the newest, or the one before `before`), or null when the server would not say. */
export async function fetchAudit(
  request: Request,
  adminBase: string,
  before?: number,
): Promise<AuditPage | null> {
  try {
    const response = await request(
      `${adminBase}/audit?limit=${PAGE_SIZE}${before === undefined ? "" : `&before=${before}`}`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      entries?: unknown;
      nextBefore?: unknown;
    } | null;
    if (
      !Array.isArray(body?.entries) ||
      !body.entries.every(isEntry) ||
      !(body.nextBefore === null || typeof body.nextBefore === "number")
    )
      return null;
    return { entries: body.entries, nextBefore: body.nextBefore };
  } catch {
    return null;
  }
}

/** What is shown, with an older page after it; an entry that came twice is shown once. */
export function mergeEntries(
  shown: readonly AuditEntry[],
  older: readonly AuditEntry[],
): AuditEntry[] {
  const seen = new Set(shown.map((entry) => entry.id));
  return [...shown, ...older.filter((entry) => !seen.has(entry.id))];
}
