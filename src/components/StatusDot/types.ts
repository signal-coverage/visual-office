import type { Status } from "../../../shared/presence.ts";

export interface StatusDotProps {
  status: Status;
  /** Extra classes, e.g. a margin. */
  className?: string;
}
