import { describe, expect, it } from "vitest";
import { COMMON_FLOOR_ID, type FloorInfo } from "../../../shared/floors.ts";
import { adminTools, menuItems } from "./helpers";

const office: FloorInfo = {
  id: COMMON_FLOOR_ID,
  name: "Main office",
  common: true,
  canEnter: true,
};
const hr: FloorInfo = { id: "hr", name: "HR", common: false, canEnter: true };

describe("menuItems", () => {
  it("lists the four options in order", () => {
    expect(menuItems([office, hr], false).map((item) => item.id)).toEqual([
      "enter",
      "rooms",
      "customize",
      "exit",
    ]);
    expect(menuItems([office, hr], false).map((item) => item.label)).toEqual([
      "Enter the office",
      "Enter a different office",
      "Customize character",
      "Exit",
    ]);
  });

  it("disables the other offices with a reason when there is only one", () => {
    const rooms = menuItems([office], false)[1];
    expect(rooms.disabled).toBe(true);
    expect(rooms.hint).toBe("There is only one office");
  });

  it("disables the other offices while the rooms are not known", () => {
    const rooms = menuItems(null, false)[1];
    expect(rooms.disabled).toBe(true);
    expect(rooms.hint).toBe("Looking for offices…");
  });

  it("leaves the other offices open when there are several", () => {
    const rooms = menuItems([office, hr], false)[1];
    expect(rooms.disabled).toBe(false);
    expect(rooms.hint).toBeUndefined();
  });

  it("disables everything but nothing else is hidden while joining", () => {
    const items = menuItems([office, hr], true);
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.disabled)).toBe(true);
  });
});

describe("adminTools", () => {
  it("lists only the tools the person may use, in a fixed order", () => {
    const noop = () => {};
    const tools = adminTools({ onOpenSettings: noop, onEditFloor: noop });
    expect(tools.map((tool) => tool.label)).toEqual([
      "Edit this floor",
      "Settings",
    ]);
  });

  it("is empty for a person without tools", () => {
    expect(adminTools({})).toEqual([]);
  });

  it("offers every tool to an admin", () => {
    const noop = () => {};
    expect(
      adminTools({
        onEditFloor: noop,
        onManagePeople: noop,
        onInvitePeople: noop,
        onOpenSettings: noop,
        onOpenActivity: noop,
        onOpenCalendars: noop,
        onManageRooms: noop,
        onManageGroups: noop,
        onManageContent: noop,
      }),
    ).toHaveLength(9);
  });
});
