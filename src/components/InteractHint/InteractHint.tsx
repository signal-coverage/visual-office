import * as styles from "./styles";
import type { InteractHintProps } from "./types";

export function InteractHint({ text }: InteractHintProps) {
  if (!text) return null;

  return (
    <div className={styles.hint} role="status">
      {text}
    </div>
  );
}
