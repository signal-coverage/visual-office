import { Button, Chip, Modal } from "@heroui/react";
import { FLOOR_NOT_AVAILABLE_TEXT } from "../../../shared/floors.ts";
import { BACK_LABEL, HERE_LABEL, INTRO, LOADING, TITLE } from "./consts";
import * as styles from "./styles";
import type { RoomsPanelProps } from "./types";

/**
 * The rooms of the building, as a list: where to travel, and which rooms are
 * not for this person. It only asks: the game server decides at the door.
 */
export function RoomsPanel({
  floors,
  current,
  onTravel,
  onBack,
}: RoomsPanelProps) {
  return (
    <>
      <Modal.Header>
        <Modal.Heading className={styles.title}>{TITLE}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        <p className={styles.intro}>{INTRO}</p>
        {floors === null && <p className={styles.note}>{LOADING}</p>}
        <ul className={styles.list} aria-label={TITLE}>
          {floors?.map((floor) => {
            const here = floor.id === current;
            return (
              <li key={floor.id} className={styles.row}>
                <Button
                  fullWidth
                  variant="secondary"
                  className={styles.item}
                  isDisabled={here || !floor.canEnter}
                  onPress={() => onTravel(floor.id)}
                >
                  {floor.name}
                  {here && (
                    <Chip size="sm" color="accent" className={styles.chip}>
                      {HERE_LABEL}
                    </Chip>
                  )}
                </Button>
                {!floor.canEnter && (
                  <p className={styles.note}>{FLOOR_NOT_AVAILABLE_TEXT}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Modal.Body>
      <Modal.Footer className={styles.actions}>
        <Button variant="secondary" onPress={onBack}>
          {BACK_LABEL}
        </Button>
      </Modal.Footer>
    </>
  );
}
