import { describe, expect, it } from "vitest";
import {
  sanitizeSeatRequest,
  SEAT_REFUSAL_TEXT,
  type SeatRefusal,
} from "./seats.ts";

describe("sanitizeSeatRequest", () => {
  it("accepts the id of a seat", () => {
    expect(sanitizeSeatRequest({ seat: "chair:3" })).toBe("chair:3");
  });

  it("rejects anything that is not text in the shape of an id", () => {
    for (const payload of [
      null,
      undefined,
      "chair:3",
      42,
      {},
      { seat: 3 },
      { seat: "" },
      { seat: "x".repeat(65) },
      { seat: "a b" },
      { seat: "../etc" },
      { seat: "<script>" },
    ])
      expect(sanitizeSeatRequest(payload), JSON.stringify(payload)).toBeNull();
  });

  it("has a sentence for every refusal", () => {
    const reasons: SeatRefusal[] = [
      "unknown",
      "seated",
      "taken",
      "far",
      "blocked",
      "cooldown",
    ];
    for (const reason of reasons)
      expect(SEAT_REFUSAL_TEXT[reason]).toBeTruthy();
  });
});
