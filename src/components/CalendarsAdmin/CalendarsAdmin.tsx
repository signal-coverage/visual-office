import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  fetchFeeds,
  saveFeed,
  testFeed,
  type FeedRoom,
} from "../../calendar/admin";
import { withToken } from "../../calendar/calendar";
import { roomTitle } from "../../calendar/schedule";
import { httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { CLOSE_LABEL, INTRO, LOAD_ERROR, LOADING, TITLE } from "./consts";
import { FeedRow } from "./FeedRow";
import * as styles from "./styles";
import type { CalendarsAdminProps } from "./types";

/**
 * Where the admins paste the calendar feed of each private room. The game
 * server checks that the caller is an admin and the address is a feed it may
 * read, whatever this screen shows.
 */
export function CalendarsAdmin({ getToken, onClose }: CalendarsAdminProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: withToken(getToken),
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [rooms, setRooms] = useState<FeedRoom[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void fetchFeeds(request, adminBase).then((found) => {
      setRooms(found);
      setLoaded(true);
    });
  }, [request, adminBase]);

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
            <p className={styles.notice}>{INTRO}</p>
            {!loaded && <p className={styles.notice}>{LOADING}</p>}
            {loaded && rooms === null && (
              <p className={styles.error} role="alert">
                {LOAD_ERROR}
              </p>
            )}
            {rooms && (
              <ul className={styles.rooms}>
                {rooms.map((room) => (
                  <FeedRow
                    key={room.room}
                    label={roomTitle(room)}
                    initialUrl={room.url}
                    onSave={(url) =>
                      saveFeed(request, adminBase, room.room, url)
                    }
                    onTest={(url) => testFeed(request, adminBase, url)}
                  />
                ))}
              </ul>
            )}
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
