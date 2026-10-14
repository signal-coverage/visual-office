import { MemorySettingsStore, type SettingsStore } from "./settingsStore.ts";

export const NAME_EDIT_KEY = "allow_name_edit";

/** What the company's admins decide for everybody. */
export interface CompanySettings {
  /** Whether people may choose their own name instead of the one of their profile. Off until an admin turns it on. */
  allowNameEdit(): Promise<boolean>;
  setAllowNameEdit(allow: boolean): Promise<void>;
}

export function createCompanySettings(store: SettingsStore): CompanySettings {
  return {
    async allowNameEdit() {
      return (await store.get(NAME_EDIT_KEY)) === "true";
    },
    async setAllowNameEdit(allow) {
      await store.set(NAME_EDIT_KEY, allow ? "true" : "false");
    },
  };
}

let current: CompanySettings = createCompanySettings(new MemorySettingsStore());

/** The company's settings: in memory until the server connects a database. */
export function setCompanySettings(next: CompanySettings): void {
  current = next;
}

/** Same for the whole server; hands out whichever settings are current. */
export const companySettings: CompanySettings = {
  allowNameEdit: () => current.allowNameEdit(),
  setAllowNameEdit: (allow) => current.setAllowNameEdit(allow),
};
