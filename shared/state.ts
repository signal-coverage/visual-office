import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema(
  {
    name: t.string(),
    x: t.number(),
    z: t.number(),
    yaw: t.number(),
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
