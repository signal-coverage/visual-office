import { describe, expect, it } from "vitest";
import {
  ARCHIVE_REFUSALS,
  archiveRefusal,
  isArchived,
} from "./floorArchive.ts";
import type { FloorRecord } from "./floorStore.ts";

const floor = (id: string, extra: Partial<FloorRecord> = {}): FloorRecord => ({
  id,
  name: id,
  common: false,
  createdAt: 1,
  ...extra,
});

const office = floor("office", { common: true, createdAt: 0 });

describe("isArchived", () => {
  it("is whether the floor has a moment of archiving", () => {
    expect(isArchived(floor("hr"))).toBe(false);
    expect(isArchived(floor("hr", { archivedAt: 5 }))).toBe(true);
    // A moment of 0 is still a moment
    expect(isArchived(floor("hr", { archivedAt: 0 }))).toBe(true);
  });
});

describe("archiveRefusal", () => {
  it("lets a room that is not common be archived", () => {
    expect(archiveRefusal(floor("hr"), [office, floor("hr")])).toBeNull();
  });

  it("never archives the main office, even when there are other common rooms", () => {
    const other = floor("lounge", { common: true });
    expect(archiveRefusal(office, [office, other])).toBe(ARCHIVE_REFUSALS.main);
  });

  it("never archives the last common room", () => {
    const lounge = floor("lounge", { common: true });
    // The main office is already archived (by hand in the database): the lounge is the last one
    const archivedOffice = { ...office, archivedAt: 3 };
    expect(archiveRefusal(lounge, [archivedOffice, lounge])).toBe(
      ARCHIVE_REFUSALS.lastCommon,
    );
  });

  it("lets a common room be archived while another common room remains", () => {
    const lounge = floor("lounge", { common: true });
    expect(archiveRefusal(lounge, [office, lounge])).toBeNull();
  });

  it("does not count an archived common room as the one that remains", () => {
    const lounge = floor("lounge", { common: true });
    const archivedGarden = floor("garden", { common: true, archivedAt: 2 });
    const archivedOffice = { ...office, archivedAt: 3 };
    expect(
      archiveRefusal(lounge, [archivedOffice, archivedGarden, lounge]),
    ).toBe(ARCHIVE_REFUSALS.lastCommon);
  });

  it("says why, in words for the admin", () => {
    expect(ARCHIVE_REFUSALS.main).toMatch(/main office/i);
    expect(ARCHIVE_REFUSALS.lastCommon).toMatch(/common room/i);
  });
});
