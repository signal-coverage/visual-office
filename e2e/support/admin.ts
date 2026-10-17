import { ADMIN_TOKEN, SERVER_HTTP } from "../env";

export interface ContentInput {
  floor: string;
  kind: "book" | "announcement";
  title: string;
  author?: string;
  body?: string;
  pinned?: boolean;
}

async function call(path: string, method: "GET" | "POST", body?: unknown) {
  const response = await fetch(`${SERVER_HTTP}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/** The admin API of the end-to-end server, with its throwaway token. It cannot reach anything else. */
export const admin = {
  /** Makes a room, from a template when one is given; one that already exists is left as it is. */
  async createFloor(id: string, name: string, template?: string) {
    const { status } = await call("/admin/floors", "POST", {
      id,
      name,
      ...(template ? { template } : {}),
    });
    if (status !== 201 && status !== 409)
      throw new Error(`Could not create the room ${id}: ${status}`);
  },

  /** The templates a room can be made from, as the admin API offers them. */
  async templates(): Promise<
    Array<{ id: string; name: string; description: string }>
  > {
    const { body } = await call("/admin/floors", "GET");
    return body.templates;
  },

  /** Archives a room: it disappears for everybody. The answer is the server's, whatever it is. */
  archive: (id: string) => call(`/admin/floors/${id}/archive`, "POST", {}),

  unarchive: (id: string) => call(`/admin/floors/${id}/unarchive`, "POST", {}),

  rename: (id: string, name: string) =>
    call(`/admin/floors/${id}`, "POST", { name }),

  /** Every room, archived ones too, as the Rooms screen lists them. */
  floors: () => call("/admin/floors", "GET"),

  groups: () => call("/admin/groups", "GET"),

  createGroup: (name: string) => call("/admin/groups", "POST", { name }),

  setGroupFloor: (group: string, floor: string, allowed: boolean) =>
    call(`/admin/groups/${group}/floors`, "POST", { floor, allowed }),

  setGroupMember: (group: string, userId: string, member: boolean) =>
    call(`/admin/groups/${group}/members`, "POST", { userId, member }),

  deleteGroup: (group: string) =>
    call(`/admin/groups/${group}/delete`, "POST", {}),

  async createContent(input: ContentInput): Promise<string> {
    const { status, body } = await call("/admin/content", "POST", input);
    if (status !== 201)
      throw new Error(
        `Could not create content: ${status} ${JSON.stringify(body)}`,
      );
    return body.item.id as string;
  },

  async deleteContent(id: string) {
    await call(`/admin/content/${id}/delete`, "POST", {});
  },
};
