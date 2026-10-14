import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";
import { httpUrlOf } from "../../editor/backend";
import {
  fetchRooms,
  withToken,
  type RoomCalendar,
} from "../../calendar/calendar";
import { POLL_MS } from "../../calendar/consts";
import { viewerDay } from "../../calendar/format";
import { eventRange, joinHint } from "../../calendar/schedule";
import { currentServerUrl } from "../../game/serverAddress";
import {
  CLOSE_LABEL,
  LOAD_ERROR,
  LOADING,
  NOTHING_TODAY,
  READ_ONLY_NOTE,
  STALE_NOTE,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { CalendarViewProps } from "./types";

/**
 * Today's schedule of every private room, in the viewer's own time zone, with a
 * hint on when to join. The game server decides what is shown: titles and times only.
 */
export function CalendarView({ getToken, onClose }: CalendarViewProps) {
  const [rooms, setRooms] = useState<RoomCalendar[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let current = true;
    const request = withToken(getToken);
    const load = () => {
      const at = Date.now();
      void fetchRooms(
        request,
        httpUrlOf(currentServerUrl()),
        viewerDay(at),
      ).then((found) => {
        if (!current) return;
        if (found) setRooms(found);
        setNow(at);
        setLoaded(true);
      });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [getToken]);

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
            {!loaded && <p className={styles.note}>{LOADING}</p>}
            {loaded && rooms === null && (
              <p className={styles.error} role="alert">
                {LOAD_ERROR}
              </p>
            )}
            {rooms && (
              <ul className={styles.rooms}>
                {rooms.map((room) => (
                  <li key={room.room} className={styles.room}>
                    <h3 className={styles.roomName}>{room.label}</h3>
                    <p className={styles.hint(room.current !== null)}>
                      {joinHint(room, now, room.label)}
                    </p>
                    {room.stale && <p className={styles.stale}>{STALE_NOTE}</p>}
                    {room.configured &&
                      (room.today.length === 0 ? (
                        <p className={styles.note}>{NOTHING_TODAY}</p>
                      ) : (
                        <ul className={styles.events}>
                          {room.today.map((event) => (
                            <li
                              key={`${event.start}-${event.title}`}
                              className={styles.event}
                            >
                              <span className={styles.range}>
                                {eventRange(event)}
                              </span>
                              <span className={styles.eventTitle}>
                                {event.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </Modal.Body>
          <Modal.Footer className={styles.actions}>
            <p className={styles.note}>{READ_ONLY_NOTE}</p>
            <Button variant="secondary" onPress={onClose}>
              {CLOSE_LABEL}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
