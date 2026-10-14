import { describe, expect, it } from "vitest";
import { createCompanySettings, NAME_EDIT_KEY } from "./companySettings.ts";
import { MemorySettingsStore } from "./settingsStore.ts";

describe("company settings", () => {
  it("does not let people choose their name until an admin says so", async () => {
    const settings = createCompanySettings(new MemorySettingsStore());
    expect(await settings.allowNameEdit()).toBe(false);
  });

  it("remembers what was set, both ways", async () => {
    const settings = createCompanySettings(new MemorySettingsStore());
    await settings.setAllowNameEdit(true);
    expect(await settings.allowNameEdit()).toBe(true);
    await settings.setAllowNameEdit(false);
    expect(await settings.allowNameEdit()).toBe(false);
  });

  it("keeps it in the settings store, so it survives a restart", async () => {
    const store = new MemorySettingsStore();
    await createCompanySettings(store).setAllowNameEdit(true);
    expect(await createCompanySettings(store).allowNameEdit()).toBe(true);
  });

  it("treats anything other than true in the store as off", async () => {
    const store = new MemorySettingsStore();
    await store.set(NAME_EDIT_KEY, "yes please");
    expect(await createCompanySettings(store).allowNameEdit()).toBe(false);
  });
});
