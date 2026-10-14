import { describe, expect, it } from "vitest";
import { describeFeedTest, fetchFeeds, saveFeed, testFeed } from "./admin";

const base = "https://office.example.com/admin";

function api(answer: { status?: number; body?: unknown } | Error) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const request = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  };
  return { calls, request };
}

describe("fetchFeeds", () => {
  it("brings the rooms with the address of each feed", async () => {
    const rooms = [
      {
        room: "meeting",
        label: "Meeting room",
        url: "https://x.example/a.ics",
      },
      { room: "lab", label: "Lab", url: null },
    ];
    const { request, calls } = api({ body: { rooms } });
    expect(await fetchFeeds(request, base)).toEqual(rooms);
    expect(calls[0].url).toBe(`${base}/calendars`);
  });

  it("is null when the server would not say", async () => {
    expect(await fetchFeeds(api({ status: 403 }).request, base)).toBeNull();
    expect(await fetchFeeds(api({ body: {} }).request, base)).toBeNull();
    expect(
      await fetchFeeds(api({ body: { rooms: [{ room: 1 }] } }).request, base),
    ).toBeNull();
    expect(await fetchFeeds(api(new Error("x")).request, base)).toBeNull();
  });
});

describe("saveFeed", () => {
  it("sends the address and brings the result of the test", async () => {
    const test = { ok: true, upcoming: 4 };
    const { request, calls } = api({
      body: { room: "meeting", url: "https://x.example/a.ics", test },
    });
    expect(
      await saveFeed(request, base, "meeting", "https://x.example/a.ics"),
    ).toEqual({ ok: true, url: "https://x.example/a.ics", test });
    expect(calls[0].url).toBe(`${base}/calendars`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      room: "meeting",
      url: "https://x.example/a.ics",
    });
  });

  it("removes a feed with no address", async () => {
    const { request, calls } = api({ body: { room: "meeting", url: null } });
    expect(await saveFeed(request, base, "meeting", "")).toEqual({
      ok: true,
      url: null,
      test: null,
    });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      room: "meeting",
      url: "",
    });
  });

  it("says why when the server refused", async () => {
    expect(
      await saveFeed(
        api({ status: 400, body: { error: "Use an https:// address." } })
          .request,
        base,
        "meeting",
        "http://x",
      ),
    ).toEqual({ ok: false, error: "Use an https:// address." });
  });

  it("says it could not when the server cannot be reached", async () => {
    expect(
      await saveFeed(api(new Error("offline")).request, base, "meeting", "x"),
    ).toEqual({
      ok: false,
      error: "Could not reach the server. Nothing was changed.",
    });
    expect(
      await saveFeed(api({ status: 500 }).request, base, "meeting", "x"),
    ).toEqual({
      ok: false,
      error: "Could not save that change. It was not made.",
    });
  });
});

describe("testFeed", () => {
  it("brings the result without saving anything", async () => {
    const { request, calls } = api({
      body: { test: { ok: false, error: "The calendar server answered 404." } },
    });
    expect(await testFeed(request, base, "https://x.example/a.ics")).toEqual({
      ok: true,
      test: { ok: false, error: "The calendar server answered 404." },
    });
    expect(calls[0].url).toBe(`${base}/calendars/test`);
  });

  it("says why when the address was refused", async () => {
    expect(
      await testFeed(
        api({ status: 400, body: { error: "That is not a web address." } })
          .request,
        base,
        "nonsense",
      ),
    ).toEqual({ ok: false, error: "That is not a web address." });
  });
});

describe("describeFeedTest", () => {
  it("says how many events are coming", () => {
    expect(describeFeedTest({ ok: true, upcoming: 4 })).toBe(
      "Works: 4 upcoming events in the next 30 days.",
    );
    expect(describeFeedTest({ ok: true, upcoming: 1 })).toBe(
      "Works: 1 upcoming event in the next 30 days.",
    );
  });

  it("says when the feed works but is empty", () => {
    expect(describeFeedTest({ ok: true, upcoming: 0 })).toBe(
      "Works, but there are no events in the next 30 days.",
    );
  });

  it("says why it does not work", () => {
    expect(
      describeFeedTest({
        ok: false,
        error: "The calendar server answered 404.",
      }),
    ).toBe("Does not work: The calendar server answered 404.");
  });
});
