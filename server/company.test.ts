import { describe, expect, it } from "vitest";
import { createCompany } from "./company.ts";
import { MemorySettingsStore } from "./settingsStore.ts";

describe("createCompany", () => {
  it("is nothing until the company is set up", async () => {
    const company = createCompany({ settings: new MemorySettingsStore() });
    expect(await company.get()).toBeNull();
  });

  it("takes the organization from the setting when there is one", async () => {
    const company = createCompany({
      fromEnv: "org_env",
      settings: new MemorySettingsStore(),
    });
    expect(await company.get()).toBe("org_env");
  });

  it("ignores an empty or blank setting", async () => {
    for (const fromEnv of ["", "   ", undefined]) {
      const company = createCompany({
        fromEnv,
        settings: new MemorySettingsStore(),
      });
      expect(await company.get(), String(fromEnv)).toBeNull();
    }
  });

  it("reads what was saved in the database when the setting is not there", async () => {
    const settings = new MemorySettingsStore();
    await settings.set("company_organization_id", "org_saved");
    expect(await createCompany({ settings }).get()).toBe("org_saved");
  });

  it("lets the environment win over what the database holds", async () => {
    const settings = new MemorySettingsStore();
    await settings.set("company_organization_id", "org_saved");
    expect(await createCompany({ fromEnv: "org_env", settings }).get()).toBe(
      "org_env",
    );
  });

  it("saves the organization once, and then it is the company", async () => {
    const company = createCompany({ settings: new MemorySettingsStore() });
    expect(await company.set("org_first")).toBe(true);
    expect(await company.get()).toBe("org_first");
  });

  it("does not let a second organization replace the first", async () => {
    const company = createCompany({ settings: new MemorySettingsStore() });
    await company.set("org_first");
    expect(await company.set("org_second")).toBe(false);
    expect(await company.get()).toBe("org_first");
  });

  it("does not save one when the environment already decides", async () => {
    const settings = new MemorySettingsStore();
    const company = createCompany({ fromEnv: "org_env", settings });
    expect(await company.set("org_other")).toBe(false);
    expect(await settings.get("company_organization_id")).toBeNull();
  });

  it("notices a company that another server set up, until it knows one", async () => {
    const settings = new MemorySettingsStore();
    const company = createCompany({ settings });
    expect(await company.get()).toBeNull();
    await settings.set("company_organization_id", "org_elsewhere");
    expect(await company.get()).toBe("org_elsewhere");
  });

  it("only asks the database again while it does not know the company", async () => {
    let reads = 0;
    const settings = new MemorySettingsStore();
    await settings.set("company_organization_id", "org_saved");
    const counting = {
      get: async (key: string) => {
        reads++;
        return settings.get(key);
      },
      set: settings.set.bind(settings),
      setIfAbsent: settings.setIfAbsent.bind(settings),
    };
    const company = createCompany({ settings: counting });
    await company.get();
    await company.get();
    await company.get();
    expect(reads).toBe(1);
  });
});
