import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SHELL } from "../shared/defaultShell.ts";
import { templateById } from "../shared/floorTemplates.ts";
import { sceneFor } from "../shared/layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "../shared/officeData.ts";
import { layoutMessageOf, loadFloorScene } from "./floorScene.ts";
import { MemoryLayoutStore } from "./layoutStore.ts";

const meeting = templateById("meeting")!;

describe("loadFloorScene", () => {
  it("is the default office, with no version, for a floor with no stored layout", async () => {
    const loaded = await loadFloorScene("marketing", new MemoryLayoutStore());
    expect(loaded.version).toBeNull();
    expect(loaded.scene.shell).toEqual(DEFAULT_SHELL);
    expect(loaded.scene.furniture).toEqual(
      sceneFor({ furniture: OFFICE_FURNITURE, models: OFFICE_MODELS })
        .furniture,
    );
  });

  it("is what was last published, with its shell", async () => {
    const store = new MemoryLayoutStore();
    await store.publish(
      "marketing",
      { furniture: meeting.furniture, models: [], shell: meeting.shell },
      "ana",
    );
    const loaded = await loadFloorScene("marketing", store);
    expect(loaded.version).toBe(1);
    expect(loaded.scene.shell).toEqual(meeting.shell);
    expect(loaded.scene.zones.map((zone) => zone.id)).toEqual([
      "room-a",
      "room-b",
      "room-c",
    ]);
    expect(loaded.scene.spawn).toEqual(meeting.shell.spawn);
  });

  it("uses the default shell for a stored layout that has none: old versions keep working", async () => {
    const store = new MemoryLayoutStore();
    await store.publish(
      "marketing",
      { furniture: [{ kind: "desk", x: -3, z: 3, rotation: 0 }], models: [] },
      "ana",
    );
    const loaded = await loadFloorScene("marketing", store);
    expect(loaded.version).toBe(1);
    expect(loaded.scene.shell).toEqual(DEFAULT_SHELL);
    expect(layoutMessageOf(loaded)).not.toHaveProperty("shell");
  });

  it("falls back to the default when the stored shell is broken, and says so", async () => {
    const store = new MemoryLayoutStore();
    await store.publish(
      "marketing",
      {
        furniture: [],
        models: [],
        shell: { ...meeting.shell, width: 5 },
      },
      "ana",
    );
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = await loadFloorScene("marketing", store);
    expect(loaded.scene.shell).toEqual(DEFAULT_SHELL);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to the default when the layouts cannot be read, so the floor still opens", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = await loadFloorScene("marketing", {
      current: async () => {
        throw new Error("down");
      },
    });
    expect(loaded.version).toBeNull();
    expect(loaded.scene.shell).toEqual(DEFAULT_SHELL);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("layoutMessageOf", () => {
  it("tells the players the version, the furniture, the models and the shell of the floor", async () => {
    const store = new MemoryLayoutStore();
    await store.publish(
      "marketing",
      { furniture: meeting.furniture, models: [], shell: meeting.shell },
      "ana",
    );
    const message = layoutMessageOf(await loadFloorScene("marketing", store));
    expect(message.version).toBe(1);
    expect(message.furniture).toEqual(meeting.furniture);
    expect(message.models).toEqual([]);
    expect(message.shell).toEqual(meeting.shell);
  });

  it("is the same as it always was for the default office: no shell is sent", async () => {
    const message = layoutMessageOf(
      await loadFloorScene("office", new MemoryLayoutStore()),
    );
    expect(message.version).toBeNull();
    expect(message).not.toHaveProperty("shell");
  });

  it("stays small", async () => {
    const store = new MemoryLayoutStore();
    await store.publish(
      "marketing",
      { furniture: meeting.furniture, models: [], shell: meeting.shell },
      "ana",
    );
    const text = JSON.stringify(
      layoutMessageOf(await loadFloorScene("marketing", store)),
    );
    expect(text.length).toBeLessThan(20_000);
  });
});
