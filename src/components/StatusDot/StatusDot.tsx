import { STATUS_LABELS } from "../../../shared/presence.ts";
import { cn } from "../../lib/cn";
import * as styles from "./styles";
import type { StatusDotProps } from "./types";

/** A small coloured dot that says what somebody is doing. */
export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={STATUS_LABELS[status]}
      title={STATUS_LABELS[status]}
      className={cn(styles.dot, className)}
      style={styles.color(status)}
    />
  );
}
