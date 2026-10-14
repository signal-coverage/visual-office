import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema(
  {
    name: t.string(),
    x: t.number(),
    z: t.number(),
    yaw: t.number(),
    /** How they look: indices into the palettes of appearance.ts. */
    skin: t.uint8(),
    hairColor: t.uint8(),
    hairStyle: t.uint8(),
    shirt: t.uint8(),
    pants: t.uint8(),
    /** Their colour in the chat and the people list: an index, see chatColor.ts. Unique in the room. */
    chatColor: t.uint8(),
    /** The id of the private zone they are in, or "" for the open office. */
    zone: t.string(),
    /** What they are doing, as everybody sees it: one of the statuses of presence.ts. */
    status: t.string(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

export const OfficeState = schema(
  {
    players: t.map(Player),
  },
  "OfficeState",
);
export type OfficeState = SchemaType<typeof OfficeState>;
