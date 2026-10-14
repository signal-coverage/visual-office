import { Button, Spinner } from "@heroui/react";
import { LOADING, RETRY } from "./consts";
import * as styles from "./styles";
import type { ContentNoticeProps } from "./types";

/** What a panel shows while its content is coming, or when it could not come. */
export function ContentNotice({ state, onRetry }: ContentNoticeProps) {
  if (state.status === "loading")
    return (
      <div className={styles.loading} role="status">
        <Spinner size="sm" />
        {LOADING}
      </div>
    );
  return (
    <div className={styles.failed}>
      <p className={styles.error} role="alert">
        {state.text}
      </p>
      <Button size="sm" variant="secondary" onPress={onRetry}>
        {RETRY}
      </Button>
    </div>
  );
}
