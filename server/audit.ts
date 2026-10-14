import type { Actor } from "./actor.ts";
import {
  MemoryAuditStore,
  type AuditInput,
  type AuditStore,
} from "./auditStore.ts";

/** Records something in the audit log. It never fails: what it describes has already happened. */
export type AuditRecorder = (input: AuditInput) => Promise<void>;

/** Who is in the log as the actor, for somebody calling the admin API. */
export function auditActor(actor: Actor): {
  actorUserId: string | null;
  actorName: string;
} {
  return actor.kind === "user"
    ? { actorUserId: actor.user.id, actorName: actor.user.name }
    : { actorUserId: null, actorName: "Server tools" };
}

/**
 * A recorder that writes to whichever store `current` gives. A log that cannot
 * be written is only reported: stopping a floor from opening, or a person from
 * being removed, because the note about it failed would be worse.
 */
export function createRecorder(current: () => AuditStore): AuditRecorder {
  return async (input) => {
    try {
      await current().append(input);
    } catch (error) {
      console.error("Could not write to the audit log:", error);
    }
  };
}

let store: AuditStore = new MemoryAuditStore();

/** Where the audit log is kept from now on: memory until the server connects a database. */
export function setAuditStore(next: AuditStore): void {
  store = next;
}

/** The audit log of the whole server. */
export const auditLog: AuditStore = {
  append: (input) => store.append(input),
  list: (options) => store.list(options),
};

/** Records in the audit log of the whole server. */
export const recordAudit: AuditRecorder = createRecorder(() => store);
