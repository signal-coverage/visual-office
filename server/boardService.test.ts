import { beforeEach, describe, expect, it } from "vitest";
import { boardById } from "../shared/boards.ts";
import { BoardService, type BoardHost } from "./boardService.ts";

const board = boardById("meeting")!;
/** A spot in front of the whiteboard, inside the meeting room. */
const NEAR = { x: board.center.x - 1.5, z: board.center.z };
const FAR = { x: board.center.x - 6, z: board.center.z };

interface Sent {
  to: string;
  type: string;
  payload: Record<string, unknown>;
}

function setup() {
  const zones = new Map<string, string | null>();
  const positions = new Map<string, { x: number; z: number }>();
  const sent: Sent[] = [];
  let now = 1_000_000;

  const host: BoardHost = {
    zoneOf: (id) => zones.get(id) ?? null,
    positionOf: (id) => positions.get(id),
    clientsInZone: (zone) =>
      [...zones].filter(([, z]) => z === zone).map(([id]) => id),
    send: (to, type, payload) =>
      sent.push({ to, type, payload: payload as Record<string, unknown> }),
  };
  const service = new BoardService(host, () => now);

  const join = (id: string, zone: string | null, at = NEAR) => {
    zones.set(id, zone);
    positions.set(id, at);
  };
  return {
    service,
    sent,
    join,
    advance: (ms: number) => (now += ms),
    zones,
    positions,
  };
}

const stroke = (id = 1, ink = 0, points = [[0.1, 0.2]]) => ({
  board: "meeting",
  id,
  ink,
  points,
});

describe("BoardService, drawing", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
    t.join("ana", "meeting");
    t.join("beto", "meeting");
    t.join("cami", null); // outside, in the open office
  });

  it("shows what somebody draws to everyone else in the room", () => {
    expect(t.service.draw("ana", stroke())).toBe(true);
    const received = t.sent.filter((m) => m.type === "draw");
    expect(received.map((m) => m.to)).toEqual(["beto"]);
    expect(received[0].payload).toEqual({
      board: "meeting",
      id: "ana:1",
      ink: 0,
      points: [[0.1, 0.2]],
    });
  });

  it("never shows it to somebody outside the room", () => {
    t.service.draw("ana", stroke());
    expect(t.sent.some((m) => m.to === "cami")).toBe(false);
  });

  it("does not send it back to whoever drew it", () => {
    t.service.draw("ana", stroke());
    expect(t.sent.some((m) => m.to === "ana")).toBe(false);
  });

  it("ignores drawing from somebody who is not in the room", () => {
    expect(t.service.draw("cami", stroke())).toBe(false);
    expect(t.sent).toEqual([]);
  });

  it("ignores drawing from too far away", () => {
    t.positions.set("ana", FAR);
    expect(t.service.draw("ana", stroke())).toBe(false);
    expect(t.sent).toEqual([]);
  });

  it("ignores a board that does not exist, and rubbish", () => {
    expect(t.service.draw("ana", { ...stroke(), board: "nowhere" })).toBe(
      false,
    );
    expect(t.service.draw("ana", "hello")).toBe(false);
    expect(t.service.draw("ana", { ...stroke(), points: [[7, 7]] })).toBe(
      false,
    );
    expect(t.sent).toEqual([]);
  });

  it("ignores somebody it does not know", () => {
    expect(t.service.draw("ghost", stroke())).toBe(false);
  });

  it("relays only the points it accepted", () => {
    // The first message of a very long stroke fits; nothing is relayed past the cap
    expect(
      t.service.draw(
        "ana",
        stroke(1, 0, [
          [0.1, 0.1],
          [0.2, 0.2],
        ]),
      ),
    ).toBe(true);
    const sentPoints = t.sent.at(-1)!.payload.points;
    expect(sentPoints).toEqual([
      [0.1, 0.1],
      [0.2, 0.2],
    ]);
  });

  it("slows somebody who floods it", () => {
    let accepted = 0;
    for (let i = 0; i < 200; i++)
      if (t.service.draw("ana", stroke(i))) accepted++;
    expect(accepted).toBeLessThan(200);
    expect(accepted).toBeGreaterThan(0);
  });

  it("lets them carry on after a moment", () => {
    for (let i = 0; i < 200; i++) t.service.draw("ana", stroke(i));
    expect(t.service.draw("ana", stroke(500))).toBe(false);
    t.advance(1000);
    expect(t.service.draw("ana", stroke(501))).toBe(true);
  });
});

describe("BoardService, clearing", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
    t.join("ana", "meeting");
    t.join("beto", "meeting");
    t.join("cami", null);
  });

  it("empties the board and tells the others in the room", () => {
    t.service.draw("ana", stroke());
    t.sent.length = 0;
    expect(t.service.clear("ana", { board: "meeting" })).toBe(true);
    expect(t.sent).toEqual([
      { to: "beto", type: "clearBoard", payload: { board: "meeting" } },
    ]);
  });

  it("leaves nothing for somebody who comes in afterwards", () => {
    t.service.draw("ana", stroke());
    t.service.clear("ana", { board: "meeting" });
    t.sent.length = 0;
    t.service.enteredZone("cami", "meeting");
    expect(t.sent[0].payload.strokes).toEqual([]);
  });

  it("is refused for somebody outside the room, or far away", () => {
    expect(t.service.clear("cami", { board: "meeting" })).toBe(false);
    t.positions.set("ana", FAR);
    expect(t.service.clear("ana", { board: "meeting" })).toBe(false);
  });

  it("is refused for a board that does not exist", () => {
    expect(t.service.clear("ana", { board: "nowhere" })).toBe(false);
    expect(t.service.clear("ana", undefined)).toBe(false);
  });

  it("cannot be done over and over", () => {
    expect(t.service.clear("ana", { board: "meeting" })).toBe(true);
    expect(t.service.clear("ana", { board: "meeting" })).toBe(true);
    expect(t.service.clear("ana", { board: "meeting" })).toBe(false);
  });
});

describe("BoardService, coming in", () => {
  it("gives somebody who walks in what is already on the board", () => {
    const t = setup();
    t.join("ana", "meeting");
    t.join("cami", null);
    t.service.draw(
      "ana",
      stroke(1, 2, [
        [0.1, 0.1],
        [0.2, 0.2],
      ]),
    );
    t.service.draw("ana", stroke(1, 2, [[0.3, 0.3]]));

    t.service.enteredZone("cami", "meeting");

    const snapshot = t.sent.find((m) => m.type === "board" && m.to === "cami")!;
    expect(snapshot.payload.board).toBe("meeting");
    expect(snapshot.payload.strokes).toEqual([
      {
        id: "ana:1",
        ink: 2,
        points: [
          [0.1, 0.1],
          [0.2, 0.2],
          [0.3, 0.3],
        ],
      },
    ]);
  });

  it("sends nothing for a zone without a board", () => {
    const t = setup();
    t.join("cami", null);
    t.service.enteredZone("cami", "lounge");
    expect(t.sent).toEqual([]);
  });
});
