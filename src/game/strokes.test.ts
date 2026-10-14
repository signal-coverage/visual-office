import { describe, expect, it } from "vitest";
import { MAX_POINTS_PER_MESSAGE, type Point } from "../../shared/drawing.ts";
import { StrokeBuffer, StrokeTracker } from "./strokes";

describe("StrokeTracker", () => {
  it("draws a dot for the first point of a stroke", () => {
    const tracker = new StrokeTracker();
    expect(tracker.advance("a:1", [[0.1, 0.1]])).toEqual([
      { from: null, to: [0.1, 0.1] },
    ]);
  });

  it("joins every new point to the one before it", () => {
    const tracker = new StrokeTracker();
    tracker.advance("a:1", [[0.1, 0.1]]);
    expect(
      tracker.advance("a:1", [
        [0.2, 0.2],
        [0.3, 0.3],
      ]),
    ).toEqual([
      { from: [0.1, 0.1], to: [0.2, 0.2] },
      { from: [0.2, 0.2], to: [0.3, 0.3] },
    ]);
  });

  it("continues across messages exactly as if it had come in one", () => {
    const pieces = new StrokeTracker();
    const whole = new StrokeTracker();
    const points: Point[] = [
      [0.1, 0.1],
      [0.2, 0.3],
      [0.4, 0.2],
      [0.5, 0.5],
    ];
    const split = [
      ...pieces.advance("s", points.slice(0, 2)),
      ...pieces.advance("s", points.slice(2)),
    ];
    expect(split).toEqual(whole.advance("s", points));
  });

  it("keeps strokes apart: one never connects to another", () => {
    const tracker = new StrokeTracker();
    tracker.advance("a:1", [[0.1, 0.1]]);
    tracker.advance("b:1", [[0.9, 0.9]]);
    expect(tracker.advance("a:1", [[0.2, 0.2]])).toEqual([
      { from: [0.1, 0.1], to: [0.2, 0.2] },
    ]);
  });

  it("starts fresh after a reset, so a stroke never joins what was cleared", () => {
    const tracker = new StrokeTracker();
    tracker.advance("a:1", [[0.1, 0.1]]);
    tracker.reset();
    expect(tracker.advance("a:1", [[0.5, 0.5]])).toEqual([
      { from: null, to: [0.5, 0.5] },
    ]);
  });

  it("does nothing for no points", () => {
    expect(new StrokeTracker().advance("a:1", [])).toEqual([]);
  });
});

describe("StrokeBuffer", () => {
  it("keeps points in the order they came", () => {
    const buffer = new StrokeBuffer();
    buffer.add([0.1, 0.1]);
    buffer.add([0.2, 0.1]);
    buffer.add([0.3, 0.1]);
    expect(buffer.take()).toEqual([
      [0.1, 0.1],
      [0.2, 0.1],
      [0.3, 0.1],
    ]);
  });

  it("skips points that barely moved, so a still hand does not send a flood", () => {
    const buffer = new StrokeBuffer();
    expect(buffer.add([0.5, 0.5])).toBe(true);
    expect(buffer.add([0.5001, 0.5])).toBe(false);
    expect(buffer.add([0.5, 0.5002])).toBe(false);
    expect(buffer.add([0.52, 0.5])).toBe(true);
    expect(buffer.take()).toHaveLength(2);
  });

  it("measures movement from the last point kept, not the last one seen", () => {
    const buffer = new StrokeBuffer();
    buffer.add([0.5, 0.5]);
    // Many tiny steps that add up to something visible must eventually count
    let kept = 0;
    for (let i = 1; i <= 100; i++)
      if (buffer.add([0.5 + i * 0.0004, 0.5])) kept++;
    expect(kept).toBeGreaterThan(5);
  });

  it("hands out at most one message's worth at a time, and keeps the rest", () => {
    const buffer = new StrokeBuffer();
    for (let i = 0; i < MAX_POINTS_PER_MESSAGE * 2 + 5; i++)
      buffer.add([(i % 50) / 50, i / 400]);
    const first = buffer.take();
    expect(first).toHaveLength(MAX_POINTS_PER_MESSAGE);
    expect(buffer.pending).toBe(MAX_POINTS_PER_MESSAGE + 5);
    expect(buffer.take()).toHaveLength(MAX_POINTS_PER_MESSAGE);
    expect(buffer.take()).toHaveLength(5);
    expect(buffer.take()).toEqual([]);
    expect(buffer.pending).toBe(0);
  });

  it("does not count a point as moved from one that was already sent", () => {
    const buffer = new StrokeBuffer();
    buffer.add([0.5, 0.5]);
    buffer.take();
    expect(buffer.add([0.5001, 0.5])).toBe(false);
  });
});
