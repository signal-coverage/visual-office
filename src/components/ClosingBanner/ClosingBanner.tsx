import { useEffect, useState } from "react";
import { closingText } from "./consts";
import * as styles from "./styles";
import type { ClosingBannerProps } from "./types";

/**
 * Counts down, a second at a time, to the moment the floor closes for editing.
 * Give it a `key` that changes with each announcement so the count starts over.
 */
export function ClosingBanner({ seconds }: ClosingBannerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (seconds === null) return;
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  if (seconds === null) return null;
  return (
    <div className={styles.banner} role="alert">
      {closingText(Math.max(0, seconds - elapsed))}
    </div>
  );
}
