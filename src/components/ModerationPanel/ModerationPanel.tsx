import { Button, Label, Modal, NumberField } from "@heroui/react";
import { useState } from "react";
import {
  banMinutes,
  DEFAULT_BAN_MINUTES,
  MAX_BAN_MINUTES,
  MIN_BAN_MINUTES,
  type ModerationAction,
} from "../../../shared/moderation.ts";
import { StatusDot } from "../StatusDot";
import { MODERATION } from "./consts";
import { confirmQuestion, needsConfirmation } from "./helpers";
import * as styles from "./styles";
import type { ModerationPanelProps } from "./types";

/**
 * What a moderator can do to the people in the office. It only asks: the game
 * server decides, from who the moderator really is, whether it is allowed.
 */
export function ModerationPanel({
  people,
  onAct,
  onBack,
}: ModerationPanelProps) {
  const [minutes, setMinutes] = useState(DEFAULT_BAN_MINUTES);
  const [pending, setPending] = useState<{
    id: string;
    action: ModerationAction;
  } | null>(null);

  const act = (action: ModerationAction, id: string) => {
    if (needsConfirmation(action)) {
      setPending({ id, action });
      return;
    }
    onAct(action, id);
  };

  const confirm = () => {
    if (!pending) return;
    onAct(
      pending.action,
      pending.id,
      pending.action === "ban" ? banMinutes(minutes) : undefined,
    );
    setPending(null);
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading className={styles.title}>
          {MODERATION.title}
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        <p className={styles.intro}>{MODERATION.intro}</p>
        <NumberField
          className={styles.banLength}
          value={minutes}
          minValue={MIN_BAN_MINUTES}
          maxValue={MAX_BAN_MINUTES}
          onChange={(next) => {
            if (Number.isFinite(next)) setMinutes(next);
          }}
        >
          <Label>{MODERATION.banLength}</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
        </NumberField>
        {people.length === 0 ? (
          <p className={styles.empty}>{MODERATION.nobody}</p>
        ) : (
          <ul className={styles.list}>
            {people.map((person) => (
              <li key={person.id} className={styles.row}>
                <span className={styles.person}>
                  <StatusDot status={person.status} />
                  <span className={styles.name}>{person.name}</span>
                </span>
                {pending?.id === person.id ? (
                  <span className={styles.buttons}>
                    <span className={styles.question}>
                      {confirmQuestion(
                        pending.action,
                        person.name,
                        banMinutes(minutes),
                      )}
                    </span>
                    <Button size="sm" variant="danger" onPress={confirm}>
                      {MODERATION.confirm}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => setPending(null)}
                    >
                      {MODERATION.cancel}
                    </Button>
                  </span>
                ) : (
                  <span className={styles.buttons}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => act("mute", person.id)}
                    >
                      {MODERATION.mute}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => act("unmute", person.id)}
                    >
                      {MODERATION.unmute}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => act("kick", person.id)}
                    >
                      {MODERATION.kick}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-soft"
                      onPress={() => act("ban", person.id)}
                    >
                      {MODERATION.ban}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer className={styles.actions}>
        <Button variant="secondary" onPress={onBack}>
          {MODERATION.back}
        </Button>
      </Modal.Footer>
    </>
  );
}
