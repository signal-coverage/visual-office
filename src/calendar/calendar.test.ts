import { describe, expect, it } from "vitest";
import { fetchRooms, withToken } from "./calendar";

const server = "https://office.example.com";
const day = { dayStart: 1000, dayEnd: 90_000_000, date: "2026-03-10" };

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

const event = { title: "Sprint", start: 10, end: 20, allDay: false };
const room = {
  room: "meeting",
  label: "Meeting room",
  configured: true,
  stale: false,
  current: event,
  next: null,
  today: [event],
};

describe("fetchRooms", () => {
  it("asks for the viewer's day and brings the rooms", async () => {
    const { request, calls } = api({ body: { rooms: [room] } });
    expect(await fetchRooms(request, server, day)).toEqual([room]);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/calendar");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      dayStart: "1000",
      dayEnd: "90000000",
      date: "2026-03-10",
    });
  });

  it("is null when the server would not say, or said something odd", async () => {
    for (const answer of [
      { status: 401 },
      { body: {} },
      { body: { rooms: "no" } },
      { body: { rooms: [{ room: "meeting" }] } },
      { body: { rooms: [{ ...room, current: { title: 3 } }] } },
      { body: { rooms: [{ ...room, today: [{ title: "x" }] }] } },
    ])
      expect(await fetchRooms(api(answer).request, server, day)).toBeNull();
    expect(
      await fetchRooms(api(new Error("offline")).request, server, day),
    ).toBeNull();
  });
});

describe("withToken", () => {
  it("adds who is asking when there is a token, and nothing when there is none", async () => {
    const seen: Array<string | null> = [];
    const send = async (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("Authorization"));
      return new Response("{}");
    };
    await withToken(async () => "abc", send)("https://x.example");
    await withToken(async () => null, send)("https://x.example");
    expect(seen).toEqual(["Bearer abc", null]);
  });
});

describe("fetchRooms, with floors", () => {
  const onAnotherFloor = {
    ...room,
    room: "hr.meeting",
    floor: "hr",
    floorName: "People",
  };

  it("brings the floor of each room when the server says it", async () => {
    const { request } = api({ body: { rooms: [room, onAnotherFloor] } });
    const rooms = await fetchRooms(request, server, day);
    expect(rooms?.[1]).toMatchObject({ floor: "hr", floorName: "People" });
  });

  it("refuses a room whose floor is not text", async () => {
    const { request } = api({
      body: { rooms: [{ ...room, floor: 5, floorName: "x" }] },
    });
    expect(await fetchRooms(request, server, day)).toBeNull();
  });
});
