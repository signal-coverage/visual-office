import { zoneLabel } from "./zones.ts";

/** What the audit log records: who did what, to whom and where. */
export const AUDIT_ACTIONS = [
  "moderation.mute",
  "moderation.unmute",
  "moderation.kick",
  "moderation.ban",
  "moderation.unban",
  "floor.lock",
  "floor.unlock",
  "layout.publish",
  "layout.revert",
  "layout.mark",
  "head.assign",
  "head.remove",
  "floor.create",
  "floor.rename",
  "floor.access",
  "floor.archive",
  "floor.unarchive",
  "group.create",
  "group.rename",
  "group.delete",
  "group.member",
  "group.floor",
  "settings.allow_name_edit",
  "company.setup",
  "calendar.set",
  "calendar.clear",
  "content.create",
  "content.update",
  "content.delete",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** One line of the log, as the server keeps it and the admin API answers it. */
export interface AuditEntry {
  id: number;
  /** Milliseconds since 1970. */
  at: number;
  /** Null when the server's own tools did it. */
  actorUserId: string | null;
  actorName: string;
  /** An `AuditAction`, or something a newer server records that this one does not know. */
  action: string;
  targetUserId: string | null;
  targetName: string | null;
  floor: string | null;
  detail: Record<string, unknown>;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const numberOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** One readable line for the Activity screen: "Ana banned Beto from office for 10 minutes". */
export function describeAudit(entry: AuditEntry): string {
  const { actorName: actor, targetName, floor, detail } = entry;
  const who = targetName ?? "somebody";
  const where = floor ?? "the building";
  const version = numberOf(detail.version);

  switch (entry.action) {
    case "moderation.mute":
      return `${actor} muted ${who} in voice on ${where}`;
    case "moderation.unmute":
      return `${actor} let ${who} speak again on ${where}`;
    case "moderation.kick":
      return `${actor} removed ${who} from ${where}`;
    case "moderation.ban": {
      const minutes = numberOf(detail.minutes);
      return `${actor} banned ${who} from ${where}${minutes === null ? "" : ` for ${plural(minutes, "minute")}`}`;
    }
    case "moderation.unban":
      return `${actor} lifted the ban on ${who}`;
    case "floor.lock":
      return `${actor} closed ${where} to edit it`;
    case "floor.unlock":
      return `${actor} opened ${where} again`;
    case "layout.publish":
      return version === null
        ? `${actor} published a new version of ${where}`
        : `${actor} published version ${version} of ${where}`;
    case "layout.revert": {
      const to = numberOf(detail.revertedTo);
      return version === null || to === null
        ? `${actor} went back ${where} to an earlier version`
        : `${actor} went back ${where} to version ${to} (published as version ${version})`;
    }
    case "layout.mark":
      return version === null
        ? `${actor} vouched for a version of ${where}`
        : `${actor} vouched for version ${version} of ${where}`;
    case "head.assign":
      return `${actor} named ${who} head of ${where}`;
    case "head.remove":
      return `${actor} removed ${who} as head of ${where}`;
    case "floor.create": {
      const name = typeof detail.name === "string" ? detail.name : null;
      // The default template is the office every room had before there were templates
      const from =
        typeof detail.template === "string" && detail.template !== "office"
          ? ` from the ${detail.template} template`
          : "";
      return name
        ? `${actor} made the room ${name} (${where})${from}`
        : `${actor} made the room ${where}${from}`;
    }
    case "floor.rename": {
      const from = typeof detail.from === "string" ? detail.from : null;
      const to = typeof detail.to === "string" ? detail.to : null;
      return from && to
        ? `${actor} renamed the room ${from} to ${to} (${where})`
        : `${actor} renamed the room ${where}`;
    }
    case "floor.archive":
    case "floor.unarchive": {
      const name = typeof detail.name === "string" ? detail.name : null;
      const verb =
        entry.action === "floor.archive" ? "archived" : "brought back";
      return name
        ? `${actor} ${verb} the room ${name} (${where})`
        : `${actor} ${verb} the room ${where}`;
    }
    case "group.create":
    case "group.delete": {
      const name = typeof detail.name === "string" ? detail.name : null;
      const verb = entry.action === "group.create" ? "made" : "deleted";
      return name
        ? `${actor} ${verb} the group ${name}`
        : `${actor} ${verb} a group`;
    }
    case "group.rename": {
      const from = typeof detail.from === "string" ? detail.from : null;
      const to = typeof detail.to === "string" ? detail.to : null;
      return from && to
        ? `${actor} renamed the group ${from} to ${to}`
        : `${actor} renamed a group`;
    }
    case "group.member": {
      const name = typeof detail.name === "string" ? detail.name : null;
      if (!name || typeof detail.member !== "boolean")
        return `${actor} changed the members of a group`;
      return detail.member
        ? `${actor} added ${who} to the group ${name}`
        : `${actor} removed ${who} from the group ${name}`;
    }
    case "group.floor": {
      const name = typeof detail.name === "string" ? detail.name : null;
      if (!name || typeof detail.allowed !== "boolean" || !floor)
        return `${actor} changed the rooms of a group`;
      return detail.allowed
        ? `${actor} let the group ${name} enter ${floor}`
        : `${actor} stopped the group ${name} entering ${floor}`;
    }
    case "floor.access":
      return detail.allowed === true
        ? `${actor} let ${who} enter ${where}`
        : `${actor} stopped ${who} entering ${where}`;
    case "settings.allow_name_edit":
      return detail.allow === true
        ? `${actor} let people choose their own name`
        : `${actor} stopped people choosing their own name`;
    case "company.setup":
      return `${actor} set the company up`;
    case "calendar.set":
    case "calendar.clear": {
      const named =
        typeof detail.label === "string"
          ? typeof detail.floor === "string"
            ? `${detail.label} (${detail.floor})`
            : detail.label
          : null;
      const room =
        named ??
        (typeof detail.room === "string" ? zoneLabel(detail.room) : "a room");
      return entry.action === "calendar.set"
        ? `${actor} set the calendar of ${room}`
        : `${actor} removed the calendar of ${room}`;
    }
    case "content.create":
    case "content.update":
    case "content.delete": {
      const kind =
        detail.kind === "book" || detail.kind === "announcement"
          ? detail.kind
          : null;
      const title = typeof detail.title === "string" ? detail.title : null;
      const verb = {
        "content.create": "added",
        "content.update": "changed",
        "content.delete": "removed",
      }[entry.action];
      const preposition = {
        "content.create": "to",
        "content.update": "of",
        "content.delete": "from",
      }[entry.action];
      const what = kind && title ? `the ${kind} "${title}"` : "something";
      return `${actor} ${verb} ${what} ${preposition} ${where}`;
    }
    default:
      return `${actor} did ${entry.action}${floor ? ` on ${floor}` : ""}`;
  }
}
