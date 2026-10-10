import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME, SERVER_PORT } from "../shared/constants.ts";
import { OfficeRoom } from "./OfficeRoom.ts";

const port = Number(process.env.PORT ?? SERVER_PORT);

const server = new Server({
  transport: new WebSocketTransport(),
  // Hosting platforms poll this to know the process is alive
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });
  },
});
server.define(ROOM_NAME, OfficeRoom);

await server.listen(port);
console.log(`Office server listening on ws://localhost:${port}`);
