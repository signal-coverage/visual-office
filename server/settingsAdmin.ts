import { auditActor, type AuditRecorder } from "./audit.ts";
import type { CompanySettings } from "./companySettings.ts";
import type { AdminReply, AdminRequest } from "./floorAdmin.ts";

const SETTINGS = "/admin/settings";

export interface SettingsAdminDeps {
  settings: CompanySettings;
  /** Where a change is noted: who made it. */
  audit?: AuditRecorder;
}

async function route(
  request: AdminRequest,
  deps: SettingsAdminDeps,
): Promise<AdminReply | null> {
  if (request.path !== SETTINGS) return null;

  // What the company decides for everybody is for admins (and the server's own tools): not for heads of floors
  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };
  if (actor.kind === "user" && !actor.roles.admin)
    return {
      status: 403,
      body: { error: "Only admins may change the company's settings." },
    };

  if (request.method === "GET")
    return {
      status: 200,
      body: { allowNameEdit: await deps.settings.allowNameEdit() },
    };
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use GET or POST." } };

  const allowNameEdit =
    typeof request.body === "object" &&
    request.body !== null &&
    !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>).allowNameEdit
      : undefined;
  if (typeof allowNameEdit !== "boolean")
    return {
      status: 400,
      body: {
        error: "Say whether people may choose their name (true or false).",
      },
    };
  await deps.settings.setAllowNameEdit(allowNameEdit);
  await deps.audit?.({
    ...auditActor(actor),
    action: "settings.allow_name_edit",
    detail: { allow: allowNameEdit },
  });
  return { status: 200, body: { allowNameEdit } };
}

/**
 * The admin API for the company's settings: for now, whether people may choose
 * their own name. Returns null for a path that is not its own. Only admins and
 * the server's own tools may read or change them.
 */
export async function handleSettingsAdmin(
  request: AdminRequest,
  deps: SettingsAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Settings admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
