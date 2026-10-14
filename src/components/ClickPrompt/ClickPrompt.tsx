import { CLICK_PROMPT } from "./consts";
import * as styles from "./styles";
import type { ClickPromptProps } from "./types";

export function ClickPrompt({ shown }: ClickPromptProps) {
  if (!shown) return null;

  return (
    <div className={styles.prompt} role="status">
      {CLICK_PROMPT}
    </div>
  );
}
