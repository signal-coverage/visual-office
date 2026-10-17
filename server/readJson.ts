import { StringDecoder } from "node:string_decoder";

interface Readable {
  on(event: "data", listener: (chunk: Buffer) => void): unknown;
  on(event: "end", listener: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  destroy(): unknown;
}

/** The JSON a request carries, or undefined when there is none, it is not JSON, or it is larger than `maxChars` (the connection is then cut). */
export function readJson(req: Readable, maxChars: number): Promise<unknown> {
  return new Promise((resolve) => {
    const decoder = new StringDecoder("utf8");
    let text = "";
    let settled = false;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      text += decoder.write(chunk);
      if (text.length > maxChars) {
        req.destroy();
        finish(undefined);
      }
    });
    req.on("end", () => {
      text += decoder.end();
      try {
        finish(text && text.length <= maxChars ? JSON.parse(text) : undefined);
      } catch {
        finish(undefined);
      }
    });
    req.on("error", () => finish(undefined));
  });
}
