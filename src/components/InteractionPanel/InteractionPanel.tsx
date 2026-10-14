import { Button, Card, Kbd } from "@heroui/react";
import { useEffect } from "react";
import { CLOSE_CODES, CLOSE_KEYS, CLOSE_LABEL } from "./consts";
import * as styles from "./styles";
import type { InteractionPanelProps } from "./types";

/**
 * A small glass card over the scene, for what the player uses or looks at. It
 * lets the mouse through, unless it is interactive: then the mouse is free to
 * click and scroll it, and F or Esc (or its Close button) put it away.
 */
export function InteractionPanel({
  title,
  content,
  interactive = false,
  onClose,
}: InteractionPanelProps) {
  const [first, second] = CLOSE_KEYS;

  useEffect(() => {
    if (!interactive || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !CLOSE_CODES.includes(event.code)) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [interactive, onClose]);

  return (
    <Card
      className={styles.panel(interactive)}
      role="dialog"
      aria-label={title}
    >
      <Card.Header>
        <Card.Title className={styles.title}>{title}</Card.Title>
      </Card.Header>
      <Card.Content className={styles.content(interactive)}>
        {content}
      </Card.Content>
      <Card.Footer className={styles.footer}>
        Press <Kbd className={styles.key}>{first}</Kbd> or{" "}
        <Kbd className={styles.key}>{second}</Kbd> to close
        {interactive && onClose && (
          <Button
            size="sm"
            variant="secondary"
            className={styles.close}
            onPress={onClose}
          >
            {CLOSE_LABEL}
          </Button>
        )}
      </Card.Footer>
    </Card>
  );
}
