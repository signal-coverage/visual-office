import { createHash } from "node:crypto";

export const BACKUP_FORMAT = "visual-office-backup";
export const BACKUP_VERSION = 1;

const AUDIT_PAGE_SIZE = 200;
const DEFAULT_MAX_AUDIT_ENTRIES = 10_000;
const LAYOUT_HISTORY_LIMIT = 50;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RATE_LIMIT_WAIT_SECONDS = 60;

export interface HttpReply {
  status: number;
  body: unknown;
  /** From a 429's Retry-After. */
  retryAfterSeconds?: number;
}

/** The little the backup needs from HTTP: GET a path of the server's admin API as JSON. The real client adds the token; this module never sees it. */
export interface HttpClient {
  get(path: string): Promise<HttpReply>;
}

/** An expected failure: `message` says what to do, `exitCode` is the code the command exits with. */
export class BackupError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "BackupError";
    this.exitCode = exitCode;
  }
}

export interface CollectOptions {
  /** Keep the secret calendar feed addresses. They are redacted otherwise. */
  includeSecrets: boolean;
  /** Keep the whole history of every layout, not only the current one. */
  allVersions: boolean;
  /** At most this many audit entries (newest first). */
  maxAuditEntries?: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

type Json = Record<string, unknown>;

export interface BackupData {
  floors: Array<Json & { id: string }>;
  people: Array<{ id: string; name: string; isAdmin: boolean }> | null;
  floorAccess: Array<{ floor: string; userId: string }> | null;
  heads: Array<{ floor: string; userId: string }> | null;
  groups: Json[] | null;
  settings: unknown;
  calendars: Json[] | null;
  content: Record<
    string,
    { books: unknown[]; announcements: unknown[] } | null
  >;
  layouts: Record<string, { current: unknown; versions?: unknown[] }>;
  audit: unknown[] | null;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  options: { includeSecrets: boolean; allVersions: boolean };
  checksum: { algorithm: "sha256"; value: string };
  warnings: string[];
  data: BackupData;
}

const record = (value: unknown): Json =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const errorOf = (reply: HttpReply) => text(record(reply.body).error);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, inner]) => [key, canonical(inner)]),
    );
  return value;
}

/** A fingerprint of the data that does not change with the order of keys. */
export function checksumOf(data: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(data)))
    .digest("hex");
}

export function serializeBackup(file: BackupFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function hostOf(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Reads the app's own data through the admin API and puts it in one backup. A
 * part that cannot be read is left null and noted in `warnings`; a server that
 * cannot be reached, or does not allow the caller, stops it with a BackupError.
 */
export async function collectBackup(
  http: HttpClient,
  options: CollectOptions,
): Promise<{ file: BackupFile; warnings: string[] }> {
  const warnings: string[] = [];

  async function get(path: string): Promise<HttpReply> {
    for (let attempt = 0; ; attempt++) {
      let reply: HttpReply;
      try {
        reply = await http.get(path);
      } catch {
        throw new BackupError(
          "Could not reach the server. Check the address and your connection.",
          3,
        );
      }
      if (reply.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES)
        return reply;
      const seconds = Math.min(
        MAX_RATE_LIMIT_WAIT_SECONDS,
        Math.max(1, reply.retryAfterSeconds ?? 5),
      );
      await options.sleep(seconds * 1000);
    }
  }

  /** The body of a successful answer, or null with a warning saying which part and why. */
  async function read(part: string, path: string): Promise<Json | null> {
    const reply = await get(path);
    if (reply.status === 200) return record(reply.body);
    warnings.push(
      `${part}: the server answered ${reply.status}${errorOf(reply) ? ` (${errorOf(reply)})` : ""}, so it is missing from the backup`,
    );
    return null;
  }

  const first = await get("/admin/floors");
  if (first.status === 401 || first.status === 403)
    throw new BackupError(
      "The server says this token is not allowed. Use the server's machine token (FLOOR_ADMIN_TOKEN) or the sign-in token of an admin.",
      3,
    );
  if (first.status !== 200)
    throw new BackupError(
      `The server could not list the floors (it answered ${first.status}). Nothing was backed up.`,
      3,
    );
  const floors = list(record(first.body).floors).map(record) as Array<
    Json & { id: string }
  >;

  const peopleBody = await read("People", "/admin/people");
  const people = peopleBody ? list(peopleBody.people).map(record) : null;

  const groupsBody = await read("Groups", "/admin/groups");
  const settings = await read("Settings", "/admin/settings");
  const calendarsBody = await read("Calendars", "/admin/calendars");

  const content: BackupData["content"] = {};
  const layouts: BackupData["layouts"] = {};
  for (const { id } of floors) {
    const floor = encodeURIComponent(id);
    const body = await read(
      `Content of ${id}`,
      `/admin/content?floor=${floor}`,
    );
    content[id] = body
      ? {
          books: list(body.books),
          announcements: list(body.announcements),
        }
      : null;

    const layout = await get(`/admin/floors/${floor}/layout`);
    if (layout.status === 200) layouts[id] = { current: layout.body };
    else if (layout.status === 404 && /no stored layout/i.test(errorOf(layout)))
      layouts[id] = { current: null };
    else {
      warnings.push(
        `Layout of ${id}: the server answered ${layout.status}, so it is missing from the backup`,
      );
      continue;
    }
    if (!options.allVersions || layouts[id].current === null) continue;

    const history = await read(
      `Layout history of ${id}`,
      `/admin/floors/${floor}/layout/versions`,
    );
    const numbers = list(history?.versions)
      .map((entry) => Number(record(entry).version))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (numbers.length >= LAYOUT_HISTORY_LIMIT)
      warnings.push(
        `Layout history of ${id}: the server lists only the newest ${LAYOUT_HISTORY_LIMIT} versions, older ones are not in the backup`,
      );
    const versions: unknown[] = [];
    for (const n of numbers) {
      const one = await get(`/admin/floors/${floor}/layout/versions/${n}`);
      if (one.status === 200) versions.push(one.body);
      else
        warnings.push(
          `Layout ${id} version ${n}: the server answered ${one.status}, so it is missing from the backup`,
        );
    }
    layouts[id].versions = versions;
  }

  let audit: unknown[] | null = [];
  const maxAudit = options.maxAuditEntries ?? DEFAULT_MAX_AUDIT_ENTRIES;
  let before: number | null = null;
  for (;;) {
    const page = await read(
      "Audit log",
      `/admin/audit?limit=${AUDIT_PAGE_SIZE}${before === null ? "" : `&before=${before}`}`,
    );
    if (!page) {
      audit = null;
      break;
    }
    const entries = list(page.entries);
    audit.push(...entries);
    const next = typeof page.nextBefore === "number" ? page.nextBefore : null;
    if (next === null || entries.length === 0) break;
    if (audit.length >= maxAudit) {
      audit = audit.slice(0, maxAudit);
      warnings.push(
        `The audit log is longer than the limit: only the first ${maxAudit} (newest) entries are in the backup`,
      );
      break;
    }
    before = next;
  }

  const data: BackupData = {
    floors,
    people: people
      ? people.map((person) => ({
          id: text(person.id),
          name: text(person.name),
          isAdmin: person.isAdmin === true,
        }))
      : null,
    floorAccess: people
      ? people.flatMap((person) =>
          list(person.access).map((floor) => ({
            floor: text(floor),
            userId: text(person.id),
          })),
        )
      : null,
    heads: people
      ? people.flatMap((person) =>
          list(person.headOf).map((floor) => ({
            floor: text(floor),
            userId: text(person.id),
          })),
        )
      : null,
    groups: groupsBody ? list(groupsBody.groups).map(record) : null,
    settings,
    calendars: calendarsBody
      ? list(calendarsBody.rooms)
          .map(record)
          .map(({ url, ...room }) => ({
            ...room,
            configured: typeof url === "string" && url !== "",
            host: hostOf(url),
            ...(options.includeSecrets ? { url } : {}),
          }))
      : null,
    content,
    layouts,
    audit,
  };

  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date(options.now()).toISOString(),
    options: {
      includeSecrets: options.includeSecrets,
      allVersions: options.allVersions,
    },
    checksum: { algorithm: "sha256", value: checksumOf(data) },
    warnings,
    data,
  };
  return { file, warnings };
}

export interface BackupSummary {
  version: number;
  createdAt: string;
  floors: number;
  archivedFloors: number;
  people: number;
  floorAccess: number;
  heads: number;
  groups: number;
  calendars: number;
  books: number;
  announcements: number;
  layoutVersions: number;
  auditEntries: number;
  includeSecrets: boolean;
  allVersions: boolean;
  warnings: string[];
}

const SECTIONS = [
  "floors",
  "people",
  "floorAccess",
  "heads",
  "groups",
  "settings",
  "calendars",
  "content",
  "layouts",
  "audit",
] as const;
const NEVER_NULL = new Set(["floors", "content", "layouts"]);

export type ParsedBackup =
  | { ok: true; file: BackupFile; summary: BackupSummary }
  | { ok: false; errors: string[] };

/** Checks a backup file: that it is one of ours, a version this tool reads, whole, and unchanged since it was written. */
export function parseBackup(input: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  const file = record(parsed);
  if (file.format !== BACKUP_FORMAT)
    return {
      ok: false,
      errors: ["This is not a Visual Office backup (the format is wrong)."],
    };
  const errors: string[] = [];
  const version = file.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    errors.push("The file has no valid version.");
  else if (version > BACKUP_VERSION)
    errors.push(
      `The file is version ${version}, made by a newer tool; this one reads up to version ${BACKUP_VERSION}.`,
    );

  const data = record(file.data);
  for (const section of SECTIONS) {
    if (
      !(section in data) ||
      (NEVER_NULL.has(section) && data[section] == null)
    )
      errors.push(`The section "${section}" is missing.`);
  }
  const checksum = record(file.checksum);
  if (checksum.algorithm !== "sha256" || typeof checksum.value !== "string")
    errors.push("The file has no checksum.");
  else if (checksumOf(file.data) !== checksum.value)
    errors.push(
      "The checksum does not match: the file was changed or damaged after it was written.",
    );
  if (errors.length > 0) return { ok: false, errors };

  const typed = file as unknown as BackupFile;
  const layoutVersions = Object.values(typed.data.layouts).reduce(
    (total, entry) =>
      total +
      (entry.versions ? entry.versions.length : entry.current === null ? 0 : 1),
    0,
  );
  const contents = Object.values(typed.data.content);
  return {
    ok: true,
    file: typed,
    summary: {
      version: typed.version,
      createdAt: String(typed.createdAt),
      floors: typed.data.floors.length,
      archivedFloors: typed.data.floors.filter(
        (floor) => floor.archivedAt !== undefined,
      ).length,
      people: typed.data.people?.length ?? 0,
      floorAccess: typed.data.floorAccess?.length ?? 0,
      heads: typed.data.heads?.length ?? 0,
      groups: typed.data.groups?.length ?? 0,
      calendars: typed.data.calendars?.length ?? 0,
      books: contents.reduce((sum, c) => sum + (c?.books.length ?? 0), 0),
      announcements: contents.reduce(
        (sum, c) => sum + (c?.announcements.length ?? 0),
        0,
      ),
      layoutVersions,
      auditEntries: typed.data.audit?.length ?? 0,
      includeSecrets: typed.options?.includeSecrets === true,
      allVersions: typed.options?.allVersions === true,
      warnings: list(typed.warnings).map(String),
    },
  };
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** What a backup holds, for a person to read. */
export function describeBackup(summary: BackupSummary): string {
  const lines = [
    `Backup version ${summary.version}, made ${summary.createdAt}`,
    `  ${plural(summary.floors, "floor")} (${summary.archivedFloors} archived)`,
    `  ${plural(summary.people, "person", "people")}, ${plural(summary.floorAccess, "floor entry", "floor entries")}, ${plural(summary.heads, "floor head")}`,
    `  ${plural(summary.groups, "group")}`,
    `  ${plural(summary.books, "book")}, ${plural(summary.announcements, "announcement")}`,
    `  ${plural(summary.layoutVersions, "layout version")}${summary.allVersions ? " (full history)" : " (current only)"}`,
    `  ${plural(summary.calendars, "room calendar")}${summary.includeSecrets ? " (with secret feed addresses)" : " (feed addresses left out)"}`,
    `  ${plural(summary.auditEntries, "audit entry", "audit entries")}`,
  ];
  if (summary.warnings.length > 0)
    lines.push(
      `  ${plural(summary.warnings.length, "warning")}:`,
      ...summary.warnings.map((warning) => `    - ${warning}`),
    );
  return lines.join("\n");
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The origin to call, from what a person gives (the game's ws:// or wss:// address works too). Plain http is only for this machine. */
export function normalizeServerUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(
      raw.trim().replace(/^ws(s?):\/\//i, (_, secure) => `http${secure}://`),
    );
  } catch {
    throw new BackupError(
      "--server must be the server's address, for example https://office.example.com",
      2,
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new BackupError("--server must start with https:// (or wss://).", 2);
  if (url.username || url.password)
    throw new BackupError(
      "--server must not contain a username or password.",
      2,
    );
  if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname))
    throw new BackupError(
      "--server must use https:// (a token must not travel unencrypted). Plain http is only accepted for this machine.",
      2,
    );
  return url.origin;
}

/** The token a file holds: its first line. The error never repeats what the file had. */
export function tokenFromFile(content: string): string {
  const token = content.split(/\r?\n/)[0]?.trim() ?? "";
  if (!token || /\s/.test(token))
    throw new BackupError(
      "The token file must hold the token alone on its first line.",
      2,
    );
  return token;
}
