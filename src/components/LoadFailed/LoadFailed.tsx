import { Button } from "@heroui/react";
import { LOAD_FAILED } from "./consts";
import * as styles from "./styles";
import type { LoadFailedProps } from "./types";

/** What a screen shows in place of itself when it could not be downloaded. */
export function LoadFailed({ onClose, closeLabel }: LoadFailedProps) {
  return (
    <div className={styles.notice} role="alert">
      <span>{LOAD_FAILED.text}</span>
      <Button size="sm" variant="secondary" onPress={onClose}>
        {closeLabel ?? LOAD_FAILED.close}
      </Button>
    </div>
  );
}
