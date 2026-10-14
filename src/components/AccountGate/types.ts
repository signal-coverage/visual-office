import type { ReactNode } from "react";
import type { Appearance } from "../../../shared/appearance.ts";

/** Somebody who is in the company, as the office needs to know them. */
export interface Member {
  organizationId: string;
  /** The look they chose last, or null if they never chose one. */
  appearance: Appearance | null;
  /** Whether the company lets people choose their own name. */
  canEditName: boolean;
  user: { id: string; name: string; email: string | null; isAdmin: boolean };
}

export interface AccountGateProps {
  /** The office, for somebody who is in the company. */
  children: (member: Member) => ReactNode;
}
