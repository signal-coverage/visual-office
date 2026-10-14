import type { CSSProperties } from "react";
import { STATUS_COLORS, type Status } from "../../../shared/presence.ts";

export const dot =
  "inline-block size-2.5 shrink-0 rounded-full ring-1 ring-white/70";
export const color = (status: Status): CSSProperties => ({
  backgroundColor: STATUS_COLORS[status],
});
