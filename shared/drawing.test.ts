import { describe, expect, it } from "vitest";
import {
  BoardStore,
  ERASER,
  INKS,
  MAX_POINTS_PER_BOARD,
  MAX_POINTS_PER_MESSAGE,
  MAX_POINTS_PER_STROKE,
  sanitizeStrokeMessage,
} from "./drawing.ts";

const points = (n: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [(i % 100) / 100, 0.5]);

describe("the inks", () => {
  it("offer a few colours and an eraser as the last one", () => {
    expect(INKS.length).toBeGreaterThanOrEqual(5);
    expect(ERASER).toBe(INKS.length - 1);
    expect(INKS[ERASER].color).toBe(0xffffff);
    expect(INKS[ERASER].width).toBeGreaterThan(INKS[0].width * 3);
  });

  it("draw in different colours", () => {
    const colors = INKS.map((ink) => ink.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("sanitizeStrokeMessage", () => {
  const valid = { board: "meeting", id: 3, ink: 1, points: [[0.1, 0.2]] };

  it("accepts a well-formed message", () => {
    expect(sanitizeStrokeMessage(valid)).toEqual(valid);
  });

  it("rejects anything that is not an object", () => {
    for (const raw of [undefined, null, 5, "x", [], true]) {
      expect(sanitizeStrokeMessage(raw)).toBeNull();
    }
  });

  it("needs a board name, a whole stroke number and a real ink", () => {
    expect(sanitizeStrokeMessage({ ...valid, board: 5 })).toBeNull();
    expect(sanitizeStrokeMessage({ ...valid, board: "" })).toBeNull();
    expect(sanitizeStrokeMessage({ ...valid, id: 1.5 })).toBeNull();
    expect(sanitizeStrokeMessage({ ...valid, id: -1 })).toBeNull();
    expect(sanitizeStrokeMessage({ ...valid, ink: INKS.length })).toBeNull();
    expect(sanitizeStrokeMessage({ ...valid, ink: -1 })).toBeNull();
  });

  it("rejects points that are not on the board, or not numbers", () => {
    for (const bad of [
      [-0.1, 0.5],
      [0.5, 1.1],
      [NaN, 0.5],
      [0.5, Infinity],
      ["a", 0.5],
      [0.5],
    ]) {
      expect(sanitizeStrokeMessage({ ...valid, points: [bad] })).toBeNull();
    }
    expect(
      sanitizeStrokeMessage({
        ...valid,
        points: [
          [0, 0],
          [1, 1],
        ],
      }),
    ).not.toBeNull();
  });

  it("rejects an empty list and a list that is too long", () => {
    expect(sanitizeStrokeMessage({ ...valid, points: [] })).toBeNull();
    expect(sanitizeStrokeMessage({ ...valid, points: "x" })).toBeNull();
    expect(
      sanitizeStrokeMessage({
        ...valid,
        points: points(MAX_POINTS_PER_MESSAGE),
      }),
    ).not.toBeNull();
    expect(
      sanitizeStrokeMessage({
        ...valid,
        points: points(MAX_POINTS_PER_MESSAGE + 1),
      }),
    ).toBeNull();
  });

  it("drops anything extra, so nothing unexpected is stored or relayed", () => {
    const result = sanitizeStrokeMessage({
      ...valid,
      admin: true,
      points: [[0.1, 0.2, 9]],
    });
    expect(result).toEqual(valid);
  });
});

describe("BoardStore", () => {
  const message = (id: number, pts = points(3), ink = 0) => ({
    id,
    ink,
    points: pts,
  });

  it("starts a stroke from the first message, and extends it with the next", () => {
    const store = new BoardStore();
    const first = store.append("ana", message(1, [[0.1, 0.1]]))!;
    expect(first.id).toBe("ana:1");
    expect(first.points).toEqual([[0.1, 0.1]]);

    const second = store.append(
      "ana",
      message(1, [
        [0.2, 0.2],
        [0.3, 0.3],
      ]),
    )!;
    expect(second.id).toBe("ana:1");
    expect(store.snapshot()).toHaveLength(1);
    expect(store.snapshot()[0].points).toHaveLength(3);
  });

  it("keeps two people's strokes apart even when they number them the same", () => {
    const store = new BoardStore();
    store.append("ana", message(1));
    store.append("beto", message(1));
    expect(store.snapshot().map((s) => s.id)).toEqual(["ana:1", "beto:1"]);
  });

  it("keeps the ink a stroke began with, whatever later messages claim", () => {
    const store = new BoardStore();
    store.append("ana", message(1, points(2), 2));
    const next = store.append("ana", message(1, points(2), 4))!;
    expect(next.ink).toBe(2);
    expect(store.snapshot()[0].ink).toBe(2);
  });

  it("stops one stroke from growing without end", () => {
    const store = new BoardStore();
    let accepted = 0;
    for (let i = 0; i < MAX_POINTS_PER_STROKE / 10 + 20; i++) {
      accepted +=
        store.append("ana", message(1, points(10)))?.points.length ?? 0;
    }
    expect(accepted).toBe(MAX_POINTS_PER_STROKE);
    expect(store.snapshot()[0].points).toHaveLength(MAX_POINTS_PER_STROKE);
  });

  it("refuses new points when the board is full, and keeps what is there", () => {
    const store = new BoardStore();
    const strokes = MAX_POINTS_PER_BOARD / MAX_POINTS_PER_STROKE;
    for (let s = 0; s < strokes; s++) {
      for (let i = 0; i < MAX_POINTS_PER_STROKE / 50; i++) {
        store.append("ana", message(s, points(50)));
      }
    }
    expect(store.totalPoints).toBe(MAX_POINTS_PER_BOARD);
    expect(store.append("beto", message(1, points(5)))).toBeNull();
    expect(store.totalPoints).toBe(MAX_POINTS_PER_BOARD);
  });

  it("can be cleared, and then used again", () => {
    const store = new BoardStore();
    store.append("ana", message(1));
    store.clear();
    expect(store.snapshot()).toEqual([]);
    expect(store.totalPoints).toBe(0);
    expect(store.append("ana", message(1))).not.toBeNull();
  });

  it("hands out copies, so what a caller does to them does not change the board", () => {
    const store = new BoardStore();
    store.append("ana", message(1, [[0.1, 0.1]]));
    const copy = store.snapshot();
    copy[0].points.push([0.9, 0.9]);
    copy.pop();
    expect(store.snapshot()).toHaveLength(1);
    expect(store.snapshot()[0].points).toHaveLength(1);
  });

  it("returns only the points it accepted, in the order they came", () => {
    const store = new BoardStore();
    const result = store.append(
      "ana",
      message(1, [
        [0.1, 0.1],
        [0.2, 0.2],
      ]),
    )!;
    expect(result.points).toEqual([
      [0.1, 0.1],
      [0.2, 0.2],
    ]);
  });
});
