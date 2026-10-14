import type { AdminReply, AdminRequest } from "./floorAdmin.ts";
import type { AuditStore } from "./auditStore.ts";

const AUDIT = "/admin/audit";

export const DEFAULT_AUDIT_LIMIT = 50;
export const MAX_AUDIT_LIMIT = 200;

export interface AuditAdminDeps {
  audit: AuditStore;
}

const POSITIVE_INTEGER = /^[1-9]\d{0,15}$/;

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });

async function route(
  request: AdminRequest,
  deps: AuditAdminDeps,
): Promise<AdminReply | null> {
  if (request.path !== AUDIT) return null;

  // Who did what is for admins (and the server's own tools): not for heads of floors
  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };
  if (actor.kind === "user" && !actor.roles.admin)
    return {
      status: 403,
      body: { error: "Only admins may read the activity log." },
    };
  if (request.method !== "GET")
    return { status: 405, body: { error: "Use GET." } };

  const { limit: rawLimit, before: rawBefore } = request.query ?? {};
  if (rawLimit !== undefined && !POSITIVE_INTEGER.test(rawLimit))
    return bad("The limit must be a positive whole number.");
  if (rawBefore !== undefined && !POSITIVE_INTEGER.test(rawBefore))
    return bad("The cursor (before) must be a positive whole number.");
  const limit = Math.min(
    MAX_AUDIT_LIMIT,
    rawLimit === undefined ? DEFAULT_AUDIT_LIMIT : Number(rawLimit),
  );
  const before = rawBefore === undefined ? undefined : Number(rawBefore);

  // One more than asked for says whether there is a next page, without a second question
  const found = await deps.audit.list({ limit: limit + 1, before });
  const entries = found.slice(0, limit);
  return {
    status: 200,
    body: {
      entries,
      nextBefore: found.length > limit ? entries[limit - 1].id : null,
    },
  };
}

/**
 * The admin API for the audit log: who did what, newest first, a page at a
 * time. Returns null for a path that is not its own. Only admins and the
 * server's own tools may read it.
 */
export async function handleAuditAdmin(
  request: AdminRequest,
  deps: AuditAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Audit admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
