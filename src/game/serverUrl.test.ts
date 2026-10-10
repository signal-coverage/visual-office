import { describe, expect, it } from "vitest";
import { resolveServerUrl } from "./serverUrl";

describe("resolveServerUrl", () => {
  it("uses the explicit URL when configured, in any mode", () => {
    expect(
      resolveServerUrl({
        configured: "wss://office.example.com",
        dev: false,
        hostname: "x",
      }),
    ).toBe("wss://office.example.com");
    expect(
      resolveServerUrl({
        configured: "ws://10.0.0.5:2567",
        dev: true,
        hostname: "x",
      }),
    ).toBe("ws://10.0.0.5:2567");
  });

  it("defaults to the dev server on the same host while developing", () => {
    expect(resolveServerUrl({ dev: true, hostname: "localhost" })).toBe(
      "ws://localhost:2567",
    );
    // Opening the dev site from another device on the LAN keeps working
    expect(resolveServerUrl({ dev: true, hostname: "192.168.1.20" })).toBe(
      "ws://192.168.1.20:2567",
    );
  });

  it("treats an empty value as not configured", () => {
    expect(
      resolveServerUrl({ configured: "  ", dev: true, hostname: "localhost" }),
    ).toBe("ws://localhost:2567");
  });

  it("refuses to guess in production", () => {
    expect(() =>
      resolveServerUrl({ dev: false, hostname: "office.example.com" }),
    ).toThrow(/VITE_SERVER_URL/);
  });
});
