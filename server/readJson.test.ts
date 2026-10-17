import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { readJson } from "./readJson.ts";

function request() {
  const req = new EventEmitter() as EventEmitter & { destroy: () => void };
  let destroyed = false;
  req.destroy = () => {
    destroyed = true;
  };
  return {
    req,
    wasDestroyed: () => destroyed,
    send(...chunks: Array<Buffer | string>) {
      for (const chunk of chunks)
        req.emit(
          "data",
          typeof chunk === "string" ? Buffer.from(chunk) : chunk,
        );
      req.emit("end");
    },
  };
}

describe("readJson", () => {
  it("reads the JSON a request carries", async () => {
    const { req, send } = request();
    const result = readJson(req, 100);
    send('{"a":', "1}");
    expect(await result).toEqual({ a: 1 });
  });

  it("is undefined when there is no body", async () => {
    const { req, send } = request();
    const result = readJson(req, 100);
    send();
    expect(await result).toBeUndefined();
  });

  it("is undefined when it is not JSON", async () => {
    const { req, send } = request();
    const result = readJson(req, 100);
    send("not json");
    expect(await result).toBeUndefined();
  });

  it("stops reading, and cuts the connection, when it is too large", async () => {
    const { req, send, wasDestroyed } = request();
    const result = readJson(req, 10);
    send('{"a":"', "x".repeat(50), '"}');
    expect(await result).toBeUndefined();
    expect(wasDestroyed()).toBe(true);
  });

  it("accepts exactly the limit", async () => {
    const { req, send } = request();
    const result = readJson(req, 7);
    send('{"a":1}');
    expect(await result).toEqual({ a: 1 });
  });

  it("keeps a character that arrives split across two chunks", async () => {
    const { req, send } = request();
    const whole = Buffer.from('{"name":"Ñandú"}');
    const result = readJson(req, 100);
    send(whole.subarray(0, 10), whole.subarray(10));
    expect(await result).toEqual({ name: "Ñandú" });
  });

  it("is undefined when the connection fails", async () => {
    const { req } = request();
    const result = readJson(req, 100);
    req.emit("error", new Error("reset"));
    expect(await result).toBeUndefined();
  });
});
