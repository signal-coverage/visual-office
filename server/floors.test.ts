import { describe, expect, it } from "vitest";
import { closeFloor, refreshFloor, registerRoom } from "./floors.ts";

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
