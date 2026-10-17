import {
  DEFAULT_TEMPLATE_ID,
  FLOOR_TEMPLATES,
  sanitizeTemplateId,
  templateById,
} from "../shared/floorTemplates.ts";
import {
  sanitizeFloorId,
  sanitizeFloorName,
  slugFromName,
} from "../shared/floors.ts";
import { auditActor, type AuditRecorder } from "./audit.ts";
import type { AdminReply, AdminRequest } from "./floorAdmin.ts";
import { archiveRefusal, isArchived } from "./floorArchive.ts";
import type { FloorStore } from "./floorStore.ts";
import type { LayoutStore } from "./layoutStore.ts";
import type { UserStore } from "./userStore.ts";

const MAX_USER_ID_LENGTH = 128;
const FLOORS = "/admin/floors";
const ONE_FLOOR = /^\/admin\/floors\/([^/]+)$/;
const ACCESS = /^\/admin\/floors\/([^/]+)\/access$/;
const ARCHIVE = /^\/admin\/floors\/([^/]+)\/(archive|unarchive)$/;

/** Who a template's first version is attributed to. */
const TEMPLATE_AUTHOR = "template";

export interface RoomsAdminDeps {
  floors: FloorStore;
  /** Where the first layout of a room made from a template goes. */
  layouts: Pick<LayoutStore, "publish">;
  users: Pick<UserStore, "get">;
  /** Where making, renaming and giving entries are noted: who did it. */
  audit?: AuditRecorder;
  /** Somebody's entry for a floor was taken away: the people inside may have to leave. */
  onAccessChanged?: (floor: string, userId: string) => void;
  /** A room was archived: the people inside have to leave. */
  onArchived?: (floor: string) => void;
}

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });

const FORBIDDEN: AdminReply = {
  status: 403,
  body: { error: "Only admins may make rooms and say who may enter them." },
};

function record(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** Archives a room (hides it and sends the people inside to the common room) or brings it back. Doing what is already done changes and notes nothing. */
async function archiveOrBring(
  actor: NonNullable<AdminRequest["actor"]>,
  id: string,
  archive: boolean,
  deps: RoomsAdminDeps,
): Promise<AdminReply> {
  const floor = await deps.floors.get(id);
  if (!floor) return { status: 404, body: { error: "No such floor." } };
  if (isArchived(floor) === archive) return { status: 200, body: { floor } };
  if (archive) {
    const refusal = archiveRefusal(floor, await deps.floors.list());
    if (refusal) return { status: 409, body: { error: refusal } };
  }
  const changed = archive
    ? await deps.floors.archive(id)
    : await deps.floors.unarchive(id);
  if (!changed) return { status: 404, body: { error: "No such floor." } };
  await deps.audit?.({
    ...auditActor(actor),
    action: archive ? "floor.archive" : "floor.unarchive",
    floor: id,
    detail: { name: changed.name },
  });
  if (archive) {
    try {
      deps.onArchived?.(id);
    } catch (error) {
      // The room is archived whatever the rooms make of the news: nobody can join it again
      console.error("Could not tell the rooms about the archive:", error);
    }
  }
  return { status: 200, body: { floor: changed } };
}

async function route(
  request: AdminRequest,
  deps: RoomsAdminDeps,
): Promise<AdminReply | null> {
  const list = request.path === FLOORS;
  const one = ONE_FLOOR.exec(request.path);
  const access = ACCESS.exec(request.path);
  const archiving = ARCHIVE.exec(request.path);
  // Reading one floor is the lock API's job, and so is asking what the caller may edit
  if (
    !list &&
    !archiving &&
    !(one && request.method === "POST") &&
    !(access && request.method === "POST")
  )
    return null;

  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };
  // Rooms and who may enter them are for admins (and the server's own tools): not for heads
  if (actor.kind === "user" && !actor.roles.admin) return FORBIDDEN;

  if (list) {
    if (request.method === "GET")
      return {
        status: 200,
        body: {
          floors: await deps.floors.list(),
          // Only what a person needs to choose one: the furniture and the shell stay on the server
          templates: FLOOR_TEMPLATES.map(({ id, name, description }) => ({
            id,
            name,
            description,
          })),
        },
      };
    if (request.method !== "POST")
      return { status: 405, body: { error: "Use GET or POST." } };

    const body = record(request.body);
    const name = sanitizeFloorName(body.name);
    if (!name) return bad("Say the room's name (1 to 40 characters).");
    const given = body.id;
    const id =
      given === undefined ? slugFromName(name) : sanitizeFloorId(given);
    if (!id)
      return bad(
        given === undefined
          ? "Could not make an id from that name: give one (id), with lowercase letters, digits and hyphens."
          : "That id is not allowed: use lowercase letters, digits and single hyphens, up to 32 characters.",
      );
    const templateId = sanitizeTemplateId(body.template);
    const template = templateId ? templateById(templateId) : undefined;
    if (!templateId || !template)
      return bad(
        `Choose one of the room templates: ${FLOOR_TEMPLATES.map((t) => t.id).join(", ")}.`,
      );
    const floor = await deps.floors.create({ id, name });
    if (!floor)
      return { status: 409, body: { error: "There is a room with that id." } };
    await deps.audit?.({
      ...auditActor(actor),
      action: "floor.create",
      floor: floor.id,
      detail: { name: floor.name, template: templateId },
    });
    // The default template is the office a room had before there were templates: nothing to store, the room just has it
    if (templateId !== DEFAULT_TEMPLATE_ID) {
      try {
        await deps.layouts.publish(
          floor.id,
          {
            furniture: structuredClone(template.furniture),
            models: structuredClone(template.models),
            shell: structuredClone(template.shell),
          },
          TEMPLATE_AUTHOR,
        );
      } catch (error) {
        console.error("Could not apply the template of a new room:", error);
        return {
          status: 500,
          body: {
            error:
              "The room was made, but its template could not be applied: it has the default office until it is edited.",
            floor,
          },
        };
      }
    }
    return { status: 201, body: { floor, template: templateId } };
  }

  if (archiving) {
    if (request.method !== "POST")
      return { status: 405, body: { error: "Use POST." } };
    return archiveOrBring(
      actor,
      archiving[1],
      archiving[2] === "archive",
      deps,
    );
  }

  if (one) {
    const id = one[1];
    const name = sanitizeFloorName(record(request.body).name);
    const before = await deps.floors.get(id);
    if (!before) return { status: 404, body: { error: "No such floor." } };
    if (!name) return bad("Say the room's new name (1 to 40 characters).");
    const floor = await deps.floors.rename(id, name);
    if (!floor) return { status: 404, body: { error: "No such floor." } };
    if (before.name !== floor.name)
      await deps.audit?.({
        ...auditActor(actor),
        action: "floor.rename",
        floor: id,
        detail: { from: before.name, to: floor.name },
      });
    return { status: 200, body: { floor } };
  }

  const floorId = access![1];
  const body = record(request.body);
  const { userId, allowed } = body;
  if (
    typeof userId !== "string" ||
    userId.length < 1 ||
    userId.length > MAX_USER_ID_LENGTH ||
    typeof allowed !== "boolean"
  )
    return bad(
      "Say who (userId) and whether they may enter (allowed: true or false).",
    );
  const floor = await deps.floors.get(floorId);
  if (!floor) return { status: 404, body: { error: "No such floor." } };
  if (floor.common)
    return bad("Everybody may enter a common room: there is nothing to give.");
  const person = await deps.users.get(userId);
  if (!person)
    return {
      status: 404,
      body: { error: "Nobody with that id has signed in." },
    };

  const had = (await deps.floors.floorsOf(userId)).includes(floorId);
  if (allowed) await deps.floors.grant(floorId, userId);
  else await deps.floors.revoke(floorId, userId);
  const changed = had !== allowed;
  if (changed) {
    await deps.audit?.({
      ...auditActor(actor),
      action: "floor.access",
      targetUserId: userId,
      targetName: person.name,
      floor: floorId,
      detail: { allowed },
    });
    if (!allowed) {
      try {
        deps.onAccessChanged?.(floorId, userId);
      } catch (error) {
        // The entry is gone whatever the rooms make of the news
        console.error("Could not tell the rooms about the change:", error);
      }
    }
  }
  return { status: 200, body: { floor: floorId, userId, allowed } };
}

/**
 * The admin API for rooms: the list, making one, renaming it, and who may
 * enter it. Returns null for a path that is not its own. Who may call it is
 * decided here too: admins and the server's own tools, nobody else (a head
 * of a floor can always enter it, but cannot give entries to others).
 */
export async function handleRoomsAdmin(
  request: AdminRequest,
  deps: RoomsAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Rooms admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
