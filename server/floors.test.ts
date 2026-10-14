import { describe, expect, it } from "vitest";
import { MemoryFloorStore } from "./floorStore.ts";
import {
  closeFloor,
  floorDirectory,
  floorRooms,
  knownFloorIds,
  recheckAccess,
  refreshFloor,
  registerModeratedRoom,
  registerRoom,
  setFloorStore,
} from "./floors.ts";

function fakeRoom() {
  const told: number[] = [];
  const closed: number[] = [];
  return {
    told,
    closed,
    room: {
      closeForEditing: (seconds: number) => {
        closed.push(seconds);
        return 2;
      },
      layoutPublished: (version: number) => {
        told.push(version);
      },
    },
  };
}

describe("refreshFloor", () => {
  it("tells every room of the floor which version was published", () => {
    const a = fakeRoom();
    const b = fakeRoom();
    const forgetA = registerRoom("refresh-floor", a.room);
    const forgetB = registerRoom("refresh-floor", b.room);
    refreshFloor("refresh-floor", 4);
    expect(a.told).toEqual([4]);
    expect(b.told).toEqual([4]);
    forgetA();
    forgetB();
  });

  it("does not tell the rooms of other floors", () => {
    const other = fakeRoom();
    const forget = registerRoom("another-floor", other.room);
    refreshFloor("a-floor-nobody-has", 1);
    expect(other.told).toEqual([]);
    forget();
  });

  it("does not tell a room that is gone", () => {
    const gone = fakeRoom();
    registerRoom("refresh-gone", gone.room)();
    refreshFloor("refresh-gone", 2);
    expect(gone.told).toEqual([]);
  });

  it("goes on telling the rest when one room fails", () => {
    const broken = {
      closeForEditing: () => 0,
      layoutPublished: () => {
        throw new Error("room is closing");
      },
    };
    const fine = fakeRoom();
    const forgetBroken = registerRoom("refresh-broken", broken);
    const forgetFine = registerRoom("refresh-broken", fine.room);
    expect(() => refreshFloor("refresh-broken", 3)).not.toThrow();
    expect(fine.told).toEqual([3]);
    forgetBroken();
    forgetFine();
  });
});

describe("closeFloor", () => {
  it("still closes every room and adds up how many people were told", () => {
    const a = fakeRoom();
    const b = fakeRoom();
    const forgetA = registerRoom("close-floor", a.room);
    const forgetB = registerRoom("close-floor", b.room);
    expect(closeFloor("close-floor", 7)).toBe(4);
    expect(a.closed).toEqual([7]);
    forgetA();
    forgetB();
  });
});

describe("floorRooms", () => {
  function moderatedRoom(present: string[]) {
    const removed: Array<[string, number, string]> = [];
    const muted: Array<[string, boolean]> = [];
    return {
      removed,
      muted,
      room: {
        removeUser: (userId: string, code: number, message: string) => {
          removed.push([userId, code, message]);
          return present.includes(userId) ? 1 : 0;
        },
        setVoiceMuted: async (userId: string, isMuted: boolean) => {
          muted.push([userId, isMuted]);
          return present.includes(userId) ? 1 : 0;
        },
      },
    };
  }

  it("removes somebody from every room of the floor, and says how many sessions it was", () => {
    const a = moderatedRoom(["user_ana"]);
    const b = moderatedRoom(["user_ana"]);
    const c = moderatedRoom([]);
    const forgets = [a, b, c].map((r) =>
      registerModeratedRoom("moderated-floor", r.room),
    );
    expect(
      floorRooms.removeUser("moderated-floor", "user_ana", 4005, "bye"),
    ).toBe(2);
    expect(a.removed).toEqual([["user_ana", 4005, "bye"]]);
    forgets.forEach((forget) => forget());
  });

  it("does not touch the rooms of other floors, nor rooms that are gone", () => {
    const other = moderatedRoom(["user_ana"]);
    const gone = moderatedRoom(["user_ana"]);
    const forgetOther = registerModeratedRoom("other-moderated", other.room);
    registerModeratedRoom("moderated-gone", gone.room)();
    expect(floorRooms.removeUser("moderated-gone", "user_ana", 1, "x")).toBe(0);
    expect(floorRooms.removeUser("nowhere", "user_ana", 1, "x")).toBe(0);
    expect(other.removed).toEqual([]);
    forgetOther();
  });

  it("mutes in every room of the floor", async () => {
    const a = moderatedRoom(["user_ana"]);
    const b = moderatedRoom([]);
    const forgets = [a, b].map((r) =>
      registerModeratedRoom("muted-floor", r.room),
    );
    expect(
      await floorRooms.setVoiceMuted("muted-floor", "user_ana", true),
    ).toBe(1);
    expect(a.muted).toEqual([["user_ana", true]]);
    expect(b.muted).toEqual([["user_ana", true]]);
    forgets.forEach((forget) => forget());
  });

  it("goes on removing from the other rooms when one fails, but says the mute failed when a room could not do it", async () => {
    const broken = {
      removeUser: () => {
        throw new Error("room is closing");
      },
      setVoiceMuted: async () => {
        throw new Error("LiveKit is down");
      },
    };
    const fine = moderatedRoom(["user_ana"]);
    const forgets = [broken, fine.room].map((room) =>
      registerModeratedRoom("broken-moderated", room),
    );
    expect(
      floorRooms.removeUser("broken-moderated", "user_ana", 4005, "bye"),
    ).toBe(1);
    await expect(
      floorRooms.setVoiceMuted("broken-moderated", "user_ana", true),
    ).rejects.toThrow("LiveKit is down");
    forgets.forEach((forget) => forget());
  });
});

describe("recheckAccess", () => {
  const roomThat = (heard: string[]) => ({
    removeUser: () => 0,
    setVoiceMuted: async () => 0,
    accessChanged: (userId: string) => {
      heard.push(userId);
    },
  });

  it("tells every room of the floor that somebody's access changed", () => {
    const a: string[] = [];
    const b: string[] = [];
    const forgetA = registerModeratedRoom("access-floor", roomThat(a));
    const forgetB = registerModeratedRoom("access-floor", roomThat(b));
    recheckAccess("access-floor", "user_ana");
    expect(a).toEqual(["user_ana"]);
    expect(b).toEqual(["user_ana"]);
    forgetA();
    forgetB();
  });

  it("does not tell the rooms of other floors, nor rooms that are gone", () => {
    const other: string[] = [];
    const gone: string[] = [];
    const forget = registerModeratedRoom("access-other", roomThat(other));
    registerModeratedRoom("access-gone", roomThat(gone))();
    recheckAccess("access-nobody", "user_ana");
    recheckAccess("access-gone", "user_ana");
    expect(other).toEqual([]);
    expect(gone).toEqual([]);
    forget();
  });

  it("goes on telling the rest when one room fails, and copes with rooms that cannot recheck", () => {
    const heard: string[] = [];
    const forgets = [
      registerModeratedRoom("access-mixed", {
        removeUser: () => 0,
        setVoiceMuted: async () => 0,
        accessChanged: () => {
          throw new Error("room is closing");
        },
      }),
      registerModeratedRoom("access-mixed", {
        removeUser: () => 0,
        setVoiceMuted: async () => 0,
      }),
      registerModeratedRoom("access-mixed", roomThat(heard)),
    ];
    expect(() => recheckAccess("access-mixed", "user_ana")).not.toThrow();
    expect(heard).toEqual(["user_ana"]);
    for (const forget of forgets) forget();
  });
});

describe("the floors of the server", () => {
  it("are the stored ones, asked for each time", async () => {
    const store = new MemoryFloorStore(() => 1);
    setFloorStore(store);
    expect(await knownFloorIds()).toEqual(["office"]);
    await store.create({ id: "hr", name: "People" });
    expect(await knownFloorIds()).toEqual(["office", "hr"]);
    expect((await floorDirectory.get("hr"))?.name).toBe("People");
    setFloorStore(new MemoryFloorStore());
  });
});
