import { Button, Modal } from "@heroui/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FloorPreview } from "../../../shared/floorPreview.ts";
import { withToken } from "../../calendar/calendar";
import { httpUrlOf } from "../../editor/backend";
import { fetchPreviews } from "../../floors/previews";
import { moveFocus, sortRooms } from "../../floors/rooms";
import { currentServerUrl } from "../../game/serverAddress";
import { RoomCard } from "../RoomCard";
import { CLOSE_LABEL, INTRO, PLANS_FAILED, TITLE } from "./consts";
import * as styles from "./styles";
import type { RoomsMapProps } from "./types";

/**
 * A map of the rooms of the building: every plan in grey, and in colour with
 * its name the ones the person may enter. Picking one travels there.
 */
export function RoomsMap({
  floors,
  current,
  beforeJoining = false,
  getToken,
  onTravel,
  onClose,
}: RoomsMapProps) {
  const [previews, setPreviews] = useState<FloorPreview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const grid = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let live = true;
    void fetchPreviews(withToken(getToken), httpUrlOf(currentServerUrl())).then(
      (found) => {
        if (!live) return;
        setPreviews(found);
        setFailed(found === null);
      },
    );
    return () => {
      live = false;
    };
  }, [getToken]);

  const rooms = sortRooms(floors);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const list = grid.current;
    if (!list) return;
    const cards = [...list.querySelectorAll<HTMLElement>("button")];
    const index = cards.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const columns =
      getComputedStyle(list).gridTemplateColumns.split(" ").length;
    const next = moveFocus(index, event.key, cards.length, columns);
    if (next === null) return;
    event.preventDefault();
    cards[next]?.focus();
  };

  const select = (id: string, canEnter: boolean) => {
    if (id === current && !beforeJoining) onClose();
    else if (canEnter) onTravel(id);
  };

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className={styles.dialog} aria-label={TITLE}>
          <Modal.Header>
            <Modal.Heading className={styles.title}>{TITLE}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="gap-3">
            <p className={styles.intro}>{INTRO}</p>
            {failed && (
              <p className={styles.error} role="status">
                {PLANS_FAILED}
              </p>
            )}
            <ul
              ref={grid}
              className={styles.grid}
              aria-label={TITLE}
              onKeyDown={onKeyDown}
            >
              {rooms.map((floor) => (
                <li key={floor.id}>
                  <RoomCard
                    floor={floor}
                    here={floor.id === current}
                    lastVisit={beforeJoining}
                    preview={
                      previews?.find((plan) => plan.id === floor.id) ?? null
                    }
                    onSelect={() => select(floor.id, floor.canEnter)}
                  />
                </li>
              ))}
            </ul>
          </Modal.Body>
          <Modal.Footer className={styles.actions}>
            <Button variant="secondary" onPress={onClose}>
              {CLOSE_LABEL}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
