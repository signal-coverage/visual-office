import { describe, expect, it, vi } from "vitest";
import { templateById } from "../shared/floorTemplates.ts";
import { sanitizeFloorId } from "../shared/floors.ts";
import { sanitizeShell } from "../shared/shell.ts";
import { calendarRoomId, calendarRoomsOf } from "./calendarRoomList.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryLayoutStore } from "./layoutStore.ts";

describe("calendarRoomId", () => {
  it("keeps the id the main office's rooms always had, so its feeds are not lost", () => {
    expect(calendarRoomId("office", "meeting")).toBe("meeting");
  });

  it("puts the floor in front of the room on any other floor", () => {
    expect(calendarRoomId("marketing", "meeting")).toBe("marketing.meeting");
    expect(calendarRoomId("hr", "room-a")).toBe("hr.room-a");
  });

  it("never gives two rooms the same id: a floor id and a zone id have no dots", () => {
    // Neither can have a dot, so "a.b.c" can only be one thing
    expect(sanitizeFloorId("a.b")).toBeNull();
    expect(
      sanitizeShell({
        ...templateById("meeting")!.shell,
        zones: [{ ...templateById("meeting")!.shell.zones[0], id: "b.c" }],
      })?.zones,
    ).toEqual([]);
    const ids = [
      calendarRoomId("office", "hr"),
      calendarRoomId("hr", "hr"),
      calendarRoomId("hr", "meeting"),
      calendarRoomId("office", "meeting"),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("calendarRoomsOf", () => {
  const setup = async () => {
    const floors = new MemoryFloorStore(() => 1);
    const layouts = new MemoryLayoutStore(() => 1);
    await floors.create({ id: "hr", name: "People" });
    await floors.create({ id: "events", name: "Events" });
    return { floors, layouts };
  };

  it("lists the private rooms of the main office, as before: id meeting, labelled", async () => {
    const { floors, layouts } = await setup();
    const rooms = await calendarRoomsOf(floors, layouts);
    expect(rooms[0]).toEqual({
      id: "meeting",
      label: "Meeting room",
      floor: "office",
      floorName: "Main office",
    });
  });

  it("leaves out the rooms of an archived floor, and has them again when it is brought back", async () => {
    const { floors, layouts } = await setup();
    await floors.archive("hr");
    expect(
      (await calendarRoomsOf(floors, layouts)).some(
        (room) => room.floor === "hr",
      ),
    ).toBe(false);
    await floors.unarchive("hr");
    expect(
      (await calendarRoomsOf(floors, layouts)).some(
        (room) => room.floor === "hr",
      ),
    ).toBe(true);
  });

  it("lists the rooms of a floor that has the default shell too, with the floor in front", async () => {
    const { floors, layouts } = await setup();
    const rooms = await calendarRoomsOf(floors, layouts);
    expect(rooms.find((room) => room.id === "hr.meeting")).toEqual({
      id: "hr.meeting",
      label: "Meeting room",
      floor: "hr",
      floorName: "People",
    });
  });

  it("lists the rooms the shell of each floor has, in order, and none for a floor without private rooms", async () => {
    const { floors, layouts } = await setup();
    const meeting = templateById("meeting")!;
    await layouts.publish(
      "events",
      { furniture: [], models: [], shell: meeting.shell },
      "ana",
    );
    const open = templateById("open")!;
    await layouts.publish(
      "hr",
      { furniture: [], models: [], shell: open.shell },
      "ana",
    );
    const rooms = await calendarRoomsOf(floors, layouts);
    expect(rooms.map((room) => room.id)).toEqual([
      "meeting",
      "events.room-a",
      "events.room-b",
      "events.room-c",
    ]);
    expect(rooms.filter((room) => room.floor === "events")).toHaveLength(3);
    expect(rooms.some((room) => room.floor === "hr")).toBe(false);
  });

  it("reads the shell of the newest version", async () => {
    const { floors, layouts } = await setup();
    await layouts.publish(
      "events",
      { furniture: [], models: [], shell: templateById("meeting")!.shell },
      "ana",
    );
    await layouts.publish(
      "events",
      { furniture: [], models: [], shell: templateById("lounge")!.shell },
      "ana",
    );
    const rooms = await calendarRoomsOf(floors, layouts);
    expect(rooms.some((room) => room.floor === "events")).toBe(false);
  });

  it("uses the default shell when the stored one is not usable", async () => {
    const { floors, layouts } = await setup();
    await layouts.publish(
      "events",
      {
        furniture: [],
        models: [],
        shell: { ...templateById("meeting")!.shell, width: 5 },
      },
      "ana",
    );
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const rooms = await calendarRoomsOf(floors, layouts);
    expect(rooms.some((room) => room.id === "events.meeting")).toBe(true);
    warn.mockRestore();
  });

  it("gives every room a different id", async () => {
    const { floors, layouts } = await setup();
    await layouts.publish(
      "events",
      { furniture: [], models: [], shell: templateById("meeting")!.shell },
      "ana",
    );
    const ids = (await calendarRoomsOf(floors, layouts)).map((room) => room.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
