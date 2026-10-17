import { Button, Card } from "@heroui/react";
import { BODY, DETAIL, DISMISS_LABEL, TITLE } from "./consts";
import * as styles from "./styles";
import type { TouchHintProps } from "./types";

/** Said once, the first time somebody walks the office with their fingers. */
export function TouchHint({ onDismiss }: TouchHintProps) {
  return (
    <div className={styles.wrapper}>
      <Card className={styles.card} role="dialog" aria-label={TITLE}>
        <Card.Header>
          <Card.Title>{TITLE}</Card.Title>
        </Card.Header>
        <Card.Content className="gap-2">
          <p className={styles.lead}>{BODY}</p>
          <p className={styles.body}>{DETAIL}</p>
        </Card.Content>
        <Card.Footer>
          <Button fullWidth onPress={onDismiss}>
            {DISMISS_LABEL}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
