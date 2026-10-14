import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, isIPv4, isIPv6 } from "node:net";

export type FeedResult =
  { ok: true; text: string } | { ok: false; error: string };

export interface FeedResponse {
  status: number;
  location?: string;
  contentType?: string;
  body: string;
}

/** What the fetcher needs from the network: it is injected so tests need none. */
export interface FeedNetwork {
  /** Every address a name points to. */
  resolve(host: string): Promise<string[]>;
  /**
   * One request to `address` (not to whatever the name points to now: the
   * address was checked). Never follows a redirect. Throws an Error whose message
   * is `timeout`, `too big` or `compressed` for those cases.
   */
  get(request: {
    url: URL;
    address: string;
    timeoutMs: number;
    maxBytes: number;
  }): Promise<FeedResponse>;
}

export const MAX_FEED_BYTES = 1_000_000;
export const FEED_TIMEOUT_MS = 5000;
export const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2048;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const PRIVATE_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
  ".home.arpa",
];

function ipv4Bytes(address: string): number[] | null {
  if (!isIPv4(address)) return null;
  return address.split(".").map(Number);
}

function publicIpv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
function ipv6Groups(address: string): number[] | null {
  if (!isIPv6(address)) return null;
  let text = address.split("%")[0].toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const bytes = ipv4Bytes(tail[1]);
    if (!bytes) return null;
    const hex = (high: number, low: number) => ((high << 8) | low).toString(16);
    text = `${text.slice(0, -tail[1].length)}${hex(bytes[0], bytes[1])}:${hex(bytes[2], bytes[3])}`;
  }
  const [head, rest] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = rest === undefined ? [] : rest ? rest.split(":") : [];
  const fill = rest === undefined ? 0 : 8 - left.length - right.length;
  if (fill < 0) return null;
  const groups = [...left, ...Array<string>(fill).fill("0"), ...right].map(
    (group) => parseInt(group, 16),
  );
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff)
    ? groups
    : null;
}

/** Whether an IP address is on the public internet: not private, loopback, link-local or reserved. */
export function isPublicAddress(address: string): boolean {
  const v4 = ipv4Bytes(address);
  if (v4) return publicIpv4(v4);
  const g = ipv6Groups(address);
  if (!g) return false;
  const fromPair = (high: number, low: number) => [
    high >> 8,
    high & 255,
    low >> 8,
    low & 255,
  ];
  // IPv4 inside IPv6: judged as the IPv4 address it carries
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0))
    return publicIpv4(fromPair(g[6], g[7]));
  if (g[0] === 0x2002) return publicIpv4(fromPair(g[1], g[2]));
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return false;
  // Only 2000::/3 is global unicast: the rest is private, link-local, multicast or reserved
  return (g[0] & 0xe000) === 0x2000;
}

/** How a call is configured: from the environment, so the server decides in one place. */
export interface CalendarOptions {
  /**
   * TEST ONLY. Lets feeds be plain http and on this machine, so a test can serve
   * a calendar from a local server. Never on in production, whatever the environment says.
   */
  allowLocalForTests: boolean;
}

export function calendarOptionsFromEnv(
  env: Record<string, string | undefined>,
): CalendarOptions {
  return {
    allowLocalForTests:
      env.CALENDAR_ALLOW_LOCAL_FOR_TESTS === "1" &&
      env.NODE_ENV !== "production",
  };
}

type Parsed = { url: URL } | { problem: string };

function parseFeedUrl(raw: unknown, allowLocal: boolean): Parsed {
  if (typeof raw !== "string" || raw.trim() === "")
    return { problem: "Paste the address of an iCalendar (.ics) feed." };
  const text = raw.trim().replace(/^webcals?:\/\//i, "https://");
  if (text.length > MAX_URL_LENGTH)
    return { problem: "That address is too long." };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { problem: "That is not a web address." };
  }
  if (url.protocol !== "https:" && !(allowLocal && url.protocol === "http:"))
    return { problem: "Use an https:// address." };
  if (url.username || url.password)
    return { problem: "The address must not contain a username or password." };
  if (!allowLocal) {
    if (url.port !== "" && url.port !== "443")
      return { problem: "Use the usual https port (443)." };
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (isIP(host)) {
      if (!isPublicAddress(host))
        return { problem: "That address points inside a private network." };
    } else if (
      !host.includes(".") ||
      host.endsWith(".") ||
      PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))
    )
      return { problem: "That address points inside a private network." };
  }
  return { url };
}

/** What is wrong with a feed address, or null when it can be used. */
export function feedUrlProblem(
  raw: unknown,
  allowLocal = false,
): string | null {
  const parsed = parseFeedUrl(raw, allowLocal);
  return "problem" in parsed ? parsed.problem : null;
}

/** The address of a feed in the form it is stored and fetched: webcal becomes https. */
export function normalizeFeedUrl(raw: string): string {
  return raw.trim().replace(/^webcals?:\/\//i, "https://");
}

export interface FeedFetcherOptions {
  network?: FeedNetwork;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowLocalForTests?: boolean;
  now?: () => number;
}

const failure = (error: string): FeedResult => ({ ok: false, error });

const NOT_FOUND = "That address could not be found.";

/**
 * Reads an iCalendar feed from the internet, and only from the internet: https,
 * and an address that is public after the name is resolved (every hop of a
 * redirect is checked again, and the connection goes to the address that was
 * checked, so the name cannot point somewhere else in between). The answer is
 * capped in size and time. Never throws, and never puts the address in an error.
 */
export function createFeedFetcher(
  options: FeedFetcherOptions = {},
): (rawUrl: string) => Promise<FeedResult> {
  const {
    network = nodeNetwork(),
    maxBytes = MAX_FEED_BYTES,
    timeoutMs = FEED_TIMEOUT_MS,
    maxRedirects = MAX_REDIRECTS,
    allowLocalForTests = false,
    now = Date.now,
  } = options;

  return async (rawUrl) => {
    const started = now();
    let target = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const parsed = parseFeedUrl(target, allowLocalForTests);
      if ("problem" in parsed) return failure(parsed.problem);
      const { url } = parsed;

      const host = url.hostname.replace(/^\[|\]$/g, "");
      let addresses: string[];
      try {
        addresses = isIP(host) ? [host] : await network.resolve(host);
      } catch {
        return failure(NOT_FOUND);
      }
      if (addresses.length === 0) return failure(NOT_FOUND);
      if (!allowLocalForTests && !addresses.every(isPublicAddress))
        return failure("That address points inside a private network.");

      const remaining = timeoutMs - (now() - started);
      if (remaining <= 0)
        return failure("The calendar took too long to answer.");

      let response: FeedResponse;
      try {
        response = await network.get({
          url,
          address: addresses[0],
          timeoutMs: remaining,
          maxBytes,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        if (reason === "timeout")
          return failure("The calendar took too long to answer.");
        if (reason === "too big")
          return failure("The calendar is too big (over 1 MB).");
        if (reason === "compressed")
          return failure(
            "The calendar server sent a compressed answer, which is not supported.",
          );
        return failure("The calendar could not be reached.");
      }

      if (REDIRECTS.has(response.status)) {
        if (!response.location)
          return failure("The calendar address redirects nowhere.");
        try {
          target = new URL(response.location, url).href;
        } catch {
          return failure("The calendar address redirects somewhere invalid.");
        }
        continue;
      }
      if (response.status < 200 || response.status > 299)
        return failure(`The calendar server answered ${response.status}.`);
      if (Buffer.byteLength(response.body) > maxBytes)
        return failure("The calendar is too big (over 1 MB).");
      if (!/BEGIN:VCALENDAR/i.test(response.body))
        return failure("That address does not give an iCalendar feed.");
      return { ok: true, text: response.body };
    }
    return failure("The calendar address redirects too many times.");
  };
}

/** The real network: DNS from the system, and plain node requests pinned to a checked address. */
export function nodeNetwork(): FeedNetwork {
  return {
    async resolve(host) {
      const found = await lookup(host, { all: true, verbatim: true });
      return found.map((entry) => entry.address);
    },
    get: ({ url, address, timeoutMs, maxBytes }) =>
      new Promise<FeedResponse>((resolve, reject) => {
        const client = url.protocol === "https:" ? https : http;
        let finished = false;
        const done = (outcome: () => void) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          outcome();
        };
        const request = client.request(
          url,
          {
            method: "GET",
            headers: {
              "User-Agent": "VisualOffice-Calendar/1",
              Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
              "Accept-Encoding": "identity",
            },
            // The connection goes to the address that was checked; the name only serves for TLS
            lookup: (_host, lookupOptions, callback) => {
              const family = isIP(address);
              if ((lookupOptions as { all?: boolean }).all)
                (
                  callback as unknown as (
                    error: null,
                    addresses: Array<{ address: string; family: number }>,
                  ) => void
                )(null, [{ address, family }]);
              else callback(null, address, family);
            },
          },
          (response) => {
            const encoding = response.headers["content-encoding"];
            if (encoding && encoding !== "identity") {
              response.destroy();
              done(() => reject(new Error("compressed")));
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > maxBytes) {
                request.destroy();
                done(() => reject(new Error("too big")));
                return;
              }
              chunks.push(chunk);
            });
            response.on("end", () =>
              done(() =>
                resolve({
                  status: response.statusCode ?? 0,
                  location: response.headers.location,
                  contentType: response.headers["content-type"],
                  body: Buffer.concat(chunks).toString("utf8"),
                }),
              ),
            );
            response.on("error", (error) => done(() => reject(error)));
          },
        );
        const timer = setTimeout(() => {
          request.destroy();
          done(() => reject(new Error("timeout")));
        }, timeoutMs);
        request.on("error", (error) => done(() => reject(error)));
        request.end();
      }),
  };
}
