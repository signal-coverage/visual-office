import type { SettingsStore } from "./settingsStore.ts";

export const COMPANY_KEY = "company_organization_id";

/** Which Clerk organization is the company: the people in it may enter. */
export interface Company {
  /** The organization, or null when the company has not been set up yet. */
  get(): Promise<string | null>;
  /**
   * Makes this organization the company. It can only be done once, and not at
   * all when the environment decides: false then.
   */
  set(organizationId: string): Promise<boolean>;
}

/**
 * The company is what CLERK_ORGANIZATION_ID says; without it, what the first
 * admin saved when they set the company up from the game. Once known it is
 * remembered, since it does not change.
 */
export function createCompany({
  fromEnv,
  settings,
}: {
  fromEnv?: string;
  settings: SettingsStore;
}): Company {
  const decidedByEnv = fromEnv?.trim() || null;
  let known: string | null = decidedByEnv;

  return {
    async get() {
      if (known) return known;
      known = await settings.get(COMPANY_KEY);
      return known;
    },
    async set(organizationId) {
      if (decidedByEnv) return false;
      const saved = await settings.setIfAbsent(COMPANY_KEY, organizationId);
      if (saved) known = organizationId;
      return saved;
    },
  };
}
