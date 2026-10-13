export type SessionState =
  | { kind: "idle" }
  | { kind: "starting" }
  /** `offline`: editing without a lock, because there was no game server to take one from. */
  | { kind: "editing"; offline: boolean }
  /** Was editing, but the floor's lock ran out or was taken, so it is not safe to carry on. */
  | { kind: "lost" };

export type StartResult =
  | { ok: true; told: number }
  | { ok: false; reason: "held"; heldBy: string }
  | { ok: false; reason: "unreachable" }
  | { ok: false; reason: "refused"; message: string };

export interface FloorSessionDeps {
  fetch: typeof fetch;
  /** Who is editing: stays the same for the whole page. */
  holder: string;
  onChange: (state: SessionState) => void;
  /** Sends something that still goes out while the page is closing. Returns whether it was queued. */
  beacon: (path: string, body: unknown) => boolean;
  /** Where the lock calls go: `${base}/lock`, `/heartbeat` and `/unlock`. */
  base?: string;
  /** How long the people inside get to finish before the floor closes. */
  graceSeconds?: number;
}

/** Where the lock calls go when nobody says otherwise: the development server. */
const DEFAULT_BASE = "/__editor/floor";
const DEFAULT_HEARTBEAT_MS = 15_000;
const DEFAULT_GRACE_SECONDS = 10;

/**
 * One person's editing of a floor. Starting it closes the floor to everybody
 * (the game server tells those inside and lets nobody else in), and it is kept
 * closed for as long as this session says it is still there. Finishing, or
 * closing the page, opens it again; if neither happens the lock runs out by
 * itself. See docs/BUILDING.md.
 */
export class FloorSession {
  private current: SessionState = { kind: "idle" };
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Whether the game server holds a lock for us (false when editing offline). */
  private locked = false;
  private readonly deps: FloorSessionDeps;
  private readonly base: string;

  constructor(deps: FloorSessionDeps) {
    this.deps = deps;
    this.base = deps.base ?? DEFAULT_BASE;
  }

  get state(): SessionState {
    return this.current;
  }

  async start(): Promise<StartResult> {
    this.set({ kind: "starting" });
    let response: Response;
    let body: Record<string, unknown>;
    try {
      response = await this.post("lock", {
        holder: this.deps.holder,
        graceSeconds: this.deps.graceSeconds ?? DEFAULT_GRACE_SECONDS,
      });
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      this.set({ kind: "idle" });
      return { ok: false, reason: "unreachable" };
    }

    if (response.ok) {
      this.locked = true;
      this.set({ kind: "editing", offline: false });
      const every =
        typeof body.heartbeatMs === "number"
          ? body.heartbeatMs
          : DEFAULT_HEARTBEAT_MS;
      this.timer = setInterval(() => void this.heartbeat(), every);
      return { ok: true, told: typeof body.told === "number" ? body.told : 0 };
    }

    this.set({ kind: "idle" });
    if (response.status === 409)
      return {
        ok: false,
        reason: "held",
        heldBy: String(body.heldBy ?? "somebody else"),
      };
    if (response.status === 502 && body.unreachable === true)
      return { ok: false, reason: "unreachable" };
    return {
      ok: false,
      reason: "refused",
      message:
        typeof body.error === "string"
          ? body.error
          : "The game server refused.",
    };
  }

  /** Edits without a lock: for when there is no game server, so nobody can be inside. */
  startOffline(): void {
    this.locked = false;
    this.set({ kind: "editing", offline: true });
  }

  async finish(): Promise<void> {
    if (this.current.kind !== "editing") return;
    this.stopHeartbeat();
    if (this.locked) {
      this.locked = false;
      try {
        await this.post("unlock", { holder: this.deps.holder });
      } catch {
        // Nothing more to do: without its heartbeats the lock runs out by itself
      }
    }
    this.set({ kind: "idle" });
  }

  /** The page is going away: open the floor now rather than leaving it shut until the lock runs out. */
  leavingPage(): void {
    if (!this.locked) return;
    this.deps.beacon(`${this.base}/unlock`, { holder: this.deps.holder });
  }

  private async heartbeat(): Promise<void> {
    try {
      const response = await this.post("heartbeat", {
        holder: this.deps.holder,
      });
      // 404: the lock ran out or was taken. 403: the role that allowed editing was taken away.
      if (response.status === 404 || response.status === 403) {
        this.stopHeartbeat();
        this.locked = false;
        this.set({ kind: "lost" });
      }
    } catch {
      // A hiccup: the next one will say. The lock lasts three beats.
    }
  }

  private stopHeartbeat(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private post(action: string, body: unknown): Promise<Response> {
    return this.deps.fetch(`${this.base}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private set(state: SessionState): void {
    this.current = state;
    this.deps.onChange(state);
  }
}
