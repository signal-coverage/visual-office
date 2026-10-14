import type { AuditAction, AuditEntry } from "../shared/audit.ts";

/** What is recorded when somebody does something that matters. */
export interface AuditInput {
  /** Null when the server's own tools did it. */
  actorUserId: string | null;
  actorName: string;
  action: AuditAction;
  targetUserId?: string | null;
  targetName?: string | null;
  floor?: string | null;
  detail?: Record<string, unknown>;
}

/** The record of who did what. Entries are only ever added: never edited, never deleted. */
export interface AuditStore {
  append(input: AuditInput): Promise<AuditEntry>;
  /** The newest entries first; with `before`, only the ones older than that entry's id. */
  list(options: { limit: number; before?: number }): Promise<AuditEntry[]>;
}

/** The audit log kept in this process's memory (development without a database). */
export class MemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = [];
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async append(input: AuditInput) {
    const entry: AuditEntry = {
      id: (this.entries.at(-1)?.id ?? 0) + 1,
      at: this.now(),
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      targetName: input.targetName ?? null,
      floor: input.floor ?? null,
      detail: structuredClone(input.detail ?? {}),
    };
    this.entries.push(entry);
    return structuredClone(entry);
  }

  async list({ limit, before }: { limit: number; before?: number }) {
    const older =
      before === undefined
        ? this.entries
        : this.entries.filter((entry) => entry.id < before);
    return older
      .slice(-limit)
      .reverse()
      .map((entry) => structuredClone(entry));
  }
}
