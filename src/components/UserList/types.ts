import type { Roster } from "../../../shared/roster.ts";

export interface UserListProps {
  /** Who is around, or null before the first update arrives. */
  roster: Roster | null;
}
