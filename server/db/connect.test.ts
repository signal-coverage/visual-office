import { describe, expect, it } from "vitest";
import { databaseUrlFromEnv } from "./connect.ts";

describe("databaseUrlFromEnv", () => {
  it("is the address when there is one", () => {
    expect(databaseUrlFromEnv({ DATABASE_URL: "postgres://u:p@host/db" })).toBe(
      "postgres://u:p@host/db",
    );
  });

  it("ignores spaces or line breaks pasted around it", () => {
    expect(
      databaseUrlFromEnv({ DATABASE_URL: "  postgres://u:p@host/db\n" }),
    ).toBe("postgres://u:p@host/db");
  });

  it("is nothing when it is missing or empty, so the server runs without a database", () => {
    expect(databaseUrlFromEnv({})).toBeNull();
    expect(databaseUrlFromEnv({ DATABASE_URL: "" })).toBeNull();
    expect(databaseUrlFromEnv({ DATABASE_URL: "   " })).toBeNull();
  });

  it("refuses something that is not a Postgres address, and says what to fix without printing it", () => {
    expect(() =>
      databaseUrlFromEnv({ DATABASE_URL: "mysql://u:secret@host/db" }),
    ).toThrow(/postgres/i);
    try {
      databaseUrlFromEnv({ DATABASE_URL: "mysql://u:secret@host/db" });
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  });
});
