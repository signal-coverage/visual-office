import { access, readdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import type { Plugin } from "vite";
import { COMMON_FLOOR_ID } from "../shared/floors.ts";
import { sanitizeFurniture } from "../shared/furniture.ts";
import { officeDataSource } from "../shared/officeFile.ts";
import { isModelFileName, sanitizeModels } from "../shared/props.ts";

/** A layout is a few kilobytes; anything near this is not one. */
export const MAX_BODY_BYTES = 1_000_000;
/**
 * A model that is light enough to run well is a few megabytes (docs/MODELING.md
 * asks for under about 5,000 triangles and textures of 1024 px or less).
 */
export const MAX_MODEL_BYTES = 20_000_000;

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export interface SaveDeps {
  /** Lays the file out the way the project's formatter would, so it passes the checks. */
  format: (source: string) => Promise<string>;
  write: (text: string) => Promise<void>;
}

/**
 * Turns what the editor sent into shared/officeData.ts. Only valid entries are
 * written (and the reply says how many were left out), so the file can only
 * ever hold data the game will use.
 */
export async function saveOffice(
  rawBody: string,
  deps: SaveDeps,
): Promise<Reply> {
  if (rawBody.length > MAX_BODY_BYTES)
    return {
      status: 413,
      body: { error: "That is far too large for an office." },
    };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "That is not JSON." } };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return {
      status: 400,
      body: { error: "Expected an object with the two lists." },
    };
  const { furniture, models } = parsed as Record<string, unknown>;
  if (!Array.isArray(furniture) || !Array.isArray(models))
    return {
      status: 400,
      body: { error: "Expected a furniture list and a models list." },
    };

  const keptFurniture = sanitizeFurniture(furniture);
  const keptModels = sanitizeModels(models);
  try {
    await deps.write(
      await deps.format(officeDataSource(keptFurniture, keptModels)),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: 500,
      body: { error: `Could not write the file: ${reason}` },
    };
  }
  return {
    status: 200,
    body: {
      saved: true,
      furniture: keptFurniture.length,
      models: keptModels.length,
      dropped:
        furniture.length -
        keptFurniture.length +
        (models.length - keptModels.length),
    },
  };
}

/**
 * Makes the layout the game server has published the one in shared/officeData.ts,
 * the default every build carries (the database is the truth, the file follows
 * it). What it writes goes through the same checks as saving.
 */
export async function exportPublished(
  source: { read: () => Promise<Reply> },
  deps: SaveDeps,
): Promise<Reply> {
  const reply = await source.read();
  if (reply.status === 404)
    return {
      status: 404,
      body: {
        error: "Nothing has been published yet, so there is nothing to export.",
      },
    };
  if (reply.status !== 200) return reply;

  const { version, furniture, models } = reply.body;
  const saved = await saveOffice(JSON.stringify({ furniture, models }), deps);
  return saved.status === 200
    ? { status: 200, body: { ...saved.body, exported: true, version } }
    : saved;
}

/**
 * Whether a request is addressed to this machine. The editor can rewrite a file
 * in the project, so it only answers to localhost: not to the network, and not
 * to a web page that tricks a browser into calling it under another name.
 */
export function isLocalHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : hostHeader.split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** The models available to place: the .glb files in a folder, by plain name. */
export async function listModelFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter(isModelFileName).sort();
  } catch {
    return [];
  }
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

/**
 * Whether these bytes are a real glTF binary: the header, the version, the
 * length it states and the description that starts it. Null when they are; the
 * reason, in words, when they are not. It is the file's structure that is
 * checked, not what is drawn from it.
 */
export function validateGlb(bytes: Uint8Array): string | null {
  if (bytes.length < 20) return "That is too small to be a 3D model.";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC)
    return "That is not a .glb file: it does not start like one.";
  if (view.getUint32(4, true) !== 2) return "Only glTF version 2 is supported.";
  if (view.getUint32(8, true) !== bytes.length)
    return "The file is not complete: its size does not match what it says.";
  if (view.getUint32(16, true) !== JSON_CHUNK)
    return "The model's description is missing: it should come first.";
  const length = view.getUint32(12, true);
  if (20 + length > bytes.length)
    return "The model's description runs past the end of the file.";

  let description: unknown;
  try {
    description = JSON.parse(
      new TextDecoder().decode(bytes.subarray(20, 20 + length)),
    );
  } catch {
    return "The model's description is damaged.";
  }
  const version = (description as { asset?: { version?: unknown } } | null)
    ?.asset?.version;
  return version === "2.0" ? null : "That is not glTF 2.0 data.";
}

export interface ModelFileDeps {
  exists: (name: string) => Promise<boolean>;
  write: (name: string, bytes: Uint8Array) => Promise<void>;
}

/**
 * Puts a model the person picked into public/models. The name has to be a
 * plain .glb name (nothing that could reach another folder), the content has to
 * be a real GLB of a sensible size, and an existing model is only replaced when
 * asked to be.
 */
export async function saveModelFile(
  name: string,
  bytes: Uint8Array,
  overwrite: boolean,
  deps: ModelFileDeps,
): Promise<Reply> {
  if (!isModelFileName(name))
    return {
      status: 400,
      body: {
        error:
          "The file name must be plain letters, numbers, - or _, and end in .glb.",
      },
    };
  if (bytes.length > MAX_MODEL_BYTES)
    return {
      status: 413,
      body: {
        error: "That model is too large: models should be a few megabytes.",
      },
    };
  const problem = validateGlb(bytes);
  if (problem) return { status: 400, body: { error: problem } };

  try {
    if (!overwrite && (await deps.exists(name)))
      return {
        status: 409,
        body: {
          error: `There is already a model called ${name}.`,
          exists: true,
        },
      };
    await deps.write(name, bytes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: 500,
      body: { error: `Could not save the model: ${reason}` },
    };
  }
  return { status: 200, body: { saved: true, name, bytes: bytes.length } };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      // Stop reading something that is already too big to be accepted
      if (body.length > MAX_BODY_BYTES + 1) req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
    req.on("close", () => resolve(body));
  });
}

export type FloorAction =
  "status" | "lock" | "heartbeat" | "unlock" | "layout" | "publish";

/** Where each action goes on the game server, and with which method. */
const FLOOR_ROUTES: Record<
  FloorAction,
  { path: string; method: "GET" | "POST" }
> = {
  status: { path: "", method: "GET" },
  layout: { path: "/layout", method: "GET" },
  publish: { path: "/layout", method: "POST" },
  lock: { path: "/lock", method: "POST" },
  heartbeat: { path: "/heartbeat", method: "POST" },
  unlock: { path: "/unlock", method: "POST" },
};

export interface ForwardDeps {
  fetch: typeof fetch;
  /** Where the game server is, e.g. http://localhost:2567. */
  baseUrl: string;
  /** The game server's admin token, when it has one. */
  token?: string;
  timeoutMs?: number;
}

/**
 * Passes the editor's request to lock or unlock the floor on to the game
 * server, which is the one that knows who is inside. The editor page does not
 * talk to the game server itself: that would need the admin token in the
 * browser, and permission to call across origins.
 */
export async function forwardFloor(
  action: FloorAction,
  body: unknown,
  deps: ForwardDeps,
): Promise<Reply> {
  const { path: suffix, method } = FLOOR_ROUTES[action];
  const url = `${deps.baseUrl}/admin/floors/${COMMON_FLOOR_ID}${suffix}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (deps.token) headers.Authorization = `Bearer ${deps.token}`;

  const unreachable = (why: string): Reply => ({
    status: 502,
    body: {
      error: `The game server did not answer (${why}).`,
      unreachable: true,
    },
  });
  const abort = new AbortController();
  // Reading or storing a layout may wake the database up, which takes a moment
  const patience = action === "layout" || action === "publish" ? 20_000 : 3000;
  const timer = setTimeout(() => abort.abort(), deps.timeoutMs ?? patience);
  try {
    const response = await deps.fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      signal: abort.signal,
    });
    const text = await response.text();
    try {
      return {
        status: response.status,
        body: JSON.parse(text) as Record<string, unknown>,
      };
    } catch {
      return unreachable(
        `it said ${response.status} but not in a way that makes sense`,
      );
    }
  } catch (error) {
    return unreachable(
      error instanceof Error ? error.message : "no reason given",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** The raw bytes of a request, stopping at once if it is larger than a model may be. */
function readBytes(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      chunks.push(chunk);
      if (total > MAX_MODEL_BYTES + 1) req.destroy();
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
    req.on("close", () => resolve(Buffer.concat(chunks)));
  });
}

function send(res: ServerResponse, { status, body }: Reply) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * The office editor's endpoints, in development only: the list of models,
 * "save" and "upload a model". `npm run build` does not include them, nor does
 * it ship the editor page.
 */
export function officeEditor(root = process.cwd()): Plugin {
  const dataFile = path.join(root, "shared", "officeData.ts");
  const modelsDir = path.join(root, "public", "models");

  return {
    name: "office-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__editor", (req, res, next) => {
        if (!isLocalHost(req.headers.host)) {
          send(res, {
            status: 403,
            body: { error: "The editor only answers on localhost." },
          });
          return;
        }
        const url = new URL(req.url ?? "", "http://localhost");
        const route = url.pathname;

        if (req.method === "GET" && route === "/models") {
          void listModelFiles(modelsDir).then((models) =>
            send(res, { status: 200, body: { models } }),
          );
          return;
        }
        const floorAction =
          /^\/floor\/(status|layout|publish|lock|heartbeat|unlock)$/.exec(
            route,
          )?.[1] as FloorAction | undefined;
        if (floorAction) {
          const wantsGet = FLOOR_ROUTES[floorAction].method === "GET";
          if (req.method !== (wantsGet ? "GET" : "POST")) {
            send(res, { status: 405, body: { error: "Wrong method." } });
            return;
          }
          void (wantsGet ? Promise.resolve("") : readBody(req)).then(
            async (text) => {
              let body: unknown;
              try {
                body = text ? JSON.parse(text) : undefined;
              } catch {
                body = undefined;
              }
              send(
                res,
                await forwardFloor(floorAction, body, {
                  fetch,
                  baseUrl:
                    process.env.GAME_SERVER_URL ?? "http://localhost:2567",
                  token: process.env.FLOOR_ADMIN_TOKEN,
                }),
              );
            },
          );
          return;
        }
        if (req.method === "POST" && route === "/upload") {
          const name = url.searchParams.get("name") ?? "";
          const overwrite = url.searchParams.get("overwrite") === "1";
          void readBytes(req).then(async (bytes) =>
            send(
              res,
              await saveModelFile(name, bytes, overwrite, {
                exists: (file) =>
                  access(path.join(modelsDir, file)).then(
                    () => true,
                    () => false,
                  ),
                write: (file, content) =>
                  writeFile(path.join(modelsDir, file), content),
              }),
            ),
          );
          return;
        }
        if (req.method === "POST" && route === "/export") {
          void exportPublished(
            {
              read: () =>
                forwardFloor("layout", undefined, {
                  fetch,
                  baseUrl:
                    process.env.GAME_SERVER_URL ?? "http://localhost:2567",
                  token: process.env.FLOOR_ADMIN_TOKEN,
                }),
            },
            {
              format: async (source) =>
                format(source, {
                  ...(await resolveConfig(dataFile)),
                  filepath: dataFile,
                }),
              write: (text) => writeFile(dataFile, text, "utf8"),
            },
          ).then((reply) => send(res, reply));
          return;
        }
        if (req.method === "POST" && route === "/save") {
          void readBody(req).then(async (body) =>
            send(
              res,
              await saveOffice(body, {
                format: async (source) =>
                  format(source, {
                    ...(await resolveConfig(dataFile)),
                    filepath: dataFile,
                  }),
                write: (text) => writeFile(dataFile, text, "utf8"),
              }),
            ),
          );
          return;
        }
        next();
      });
    },
  };
}
