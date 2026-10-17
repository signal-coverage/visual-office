/**
 * Where the editor gets and sends things. The same editor runs in two places:
 * on a developer's machine, where the development server answers for the game
 * server (and writes files), and inside the game, where it talks to the game
 * server itself with the signed-in person's token.
 */
export interface EditorBackend {
  /** The room being edited: missing for the main office, which the default layout file belongs to. */
  floor?: string;
  /** Where the lock calls go: `${floorBase}/lock`, `/heartbeat` and `/unlock`. */
  floorBase: string;
  /** Reading the stored layout (GET). */
  layoutUrl: string;
  /** Storing a new version of it (POST). */
  publishUrl: string;
  /** A request that carries whatever proves who is asking. */
  request: (url: string, init?: RequestInit) => Promise<Response>;
  /** The models there are to place. */
  listModels: () => Promise<string[]>;
  /** Sends something that still goes out while the page is closing. Returns whether it was queued. */
  beacon: (url: string, body: unknown) => boolean;
  /** Uploading models, writing the default layout to a file and exporting to it: only on a developer's machine. */
  devTools: boolean;
}

/** The web address of the game server, from the websocket one the game connects to. */
export function httpUrlOf(serverUrl: string): string {
  return serverUrl.replace(/^ws(s?):/, "http$1:").replace(/\/+$/, "");
}

/** On a developer's machine: the development server forwards to the game server and writes files. The main office, unless a room is named. */
export function devBackend(floor?: string): EditorBackend {
  const floorBase = floor ? `/__editor/floors/${floor}` : "/__editor/floor";
  return {
    ...(floor ? { floor } : {}),
    floorBase,
    layoutUrl: `${floorBase}/layout`,
    publishUrl: `${floorBase}/publish`,
    request: (url, init) => fetch(url, init),
    listModels: async () => {
      const response = await fetch("/__editor/models");
      return ((await response.json()) as { models: string[] }).models;
    },
    beacon: (url, body) =>
      navigator.sendBeacon(
        url,
        new Blob([JSON.stringify(body)], { type: "application/json" }),
      ),
    devTools: true,
  };
}

export interface GameBackendOptions {
  /** The game server, as the game connects to it (ws:// or wss://). */
  serverUrl: string;
  floor: string;
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** The models that came with this build. */
  models: readonly string[];
  fetch?: typeof fetch;
}

/** Inside the game: straight to the game server's admin API, as the person who signed in. */
export function gameBackend({
  serverUrl,
  floor,
  getToken,
  models,
  fetch: send = (...args) => fetch(...args),
}: GameBackendOptions): EditorBackend {
  const floorBase = `${httpUrlOf(serverUrl)}/admin/floors/${floor}`;
  // The last token used: a page that is closing cannot wait for a new one
  let lastToken: string | null = null;

  const authorized = async (init?: RequestInit): Promise<RequestInit> => {
    const token = await getToken();
    lastToken = token;
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return { ...init, headers };
  };

  return {
    floor,
    floorBase,
    layoutUrl: `${floorBase}/layout`,
    publishUrl: `${floorBase}/layout`,
    request: async (url, init) => send(url, await authorized(init)),
    listModels: async () => [...models],
    beacon: (url, body) => {
      if (!lastToken) return false;
      void send(url, {
        method: "POST",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${lastToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }).catch(() => {
        // Nothing more to do: without its heartbeats the lock runs out by itself
      });
      return true;
    },
    devTools: false,
  };
}
