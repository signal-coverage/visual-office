import { describe, expect, it } from "vitest";
import { voiceRoomName } from "../shared/voice.ts";
import { enforceZones, identitiesToEvict } from "./zoneEnforcer.ts";
import type { VoiceAdmin } from "./voice.ts";

describe("identitiesToEvict", () => {
  const issued: Record<string, string | null> = {
    ana: "meeting",
    beto: null,
  };
  const issuedZoneOf = (id: string) => issued[id];

  it("keeps whoever the server sent to that room", () => {
    expect(identitiesToEvict(["ana"], "meeting", issuedZoneOf)).toEqual([]);
    expect(identitiesToEvict(["beto"], null, issuedZoneOf)).toEqual([]);
  });

  it("evicts a player who is in a room they were not sent to", () => {
    expect(identitiesToEvict(["ana", "beto"], "meeting", issuedZoneOf)).toEqual(
      ["beto"],
    );
    expect(identitiesToEvict(["ana", "beto"], null, issuedZoneOf)).toEqual([
      "ana",
    ]);
  });

  it("leaves alone anybody this game room does not know", () => {
    // Another game room (or a service) may share the same voice rooms
    expect(identitiesToEvict(["stranger"], "meeting", issuedZoneOf)).toEqual(
      [],
    );
  });
});

describe("enforceZones", () => {
  function fakeAdmin(rooms: Record<string, string[]>) {
    const removed: [string, string][] = [];
    const admin: VoiceAdmin = {
      listParticipants: async (room) => rooms[room] ?? [],
      removeParticipant: async (room, identity) => {
        removed.push([room, identity]);
      },
    };
    return { admin, removed };
  }

  it("removes a player who stayed in the meeting after being sent back to the office", async () => {
    const { admin, removed } = fakeAdmin({
      [voiceRoomName("meeting")]: ["ana", "beto"],
      [voiceRoomName(null)]: ["cami"],
    });
    const issued: Record<string, string | null> = {
      ana: "meeting",
      beto: null,
      cami: null,
    };

    const evicted = await enforceZones(
      admin,
      [null, "meeting"],
      (id) => issued[id],
    );

    expect(removed).toEqual([[voiceRoomName("meeting"), "beto"]]);
    expect(evicted).toEqual(["beto"]);
  });

  it("looks in the company's own rooms when there is a prefix", async () => {
    const { admin, removed } = fakeAdmin({
      [voiceRoomName("meeting", "acme-")]: ["ana", "beto"],
      // somebody else's company, on the same LiveKit project: not ours to touch
      [voiceRoomName("meeting", "beta-")]: ["intruder"],
    });
    const issued: Record<string, string | null> = {
      ana: "meeting",
      beto: null,
    };

    await enforceZones(admin, ["meeting"], (id) => issued[id], "acme-");

    expect(removed).toEqual([[voiceRoomName("meeting", "acme-"), "beto"]]);
  });

  it("does nothing when everybody is where they should be", async () => {
    const { admin, removed } = fakeAdmin({
      [voiceRoomName("meeting")]: ["ana"],
    });
    await enforceZones(admin, [null, "meeting"], () => "meeting");
    expect(removed).toEqual([]);
  });

  it("keeps checking the other rooms when one cannot be listed", async () => {
    const { admin, removed } = fakeAdmin({
      [voiceRoomName("meeting")]: ["beto"],
    });
    const issued: Record<string, string | null> = { beto: null };
    const original = admin.listParticipants;
    admin.listParticipants = async (room) => {
      if (room === voiceRoomName(null)) throw new Error("boom");
      return original(room);
    };
    await enforceZones(admin, [null, "meeting"], (id) => issued[id]);
    expect(removed).toEqual([[voiceRoomName("meeting"), "beto"]]);
  });
});
