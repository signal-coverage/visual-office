import { Card, Chip, Link } from "@heroui/react";
import { useState } from "react";
import { orderAnnouncements } from "../../../shared/content.ts";
import { withToken } from "../../calendar/calendar";
import { contentCache } from "../../content/content";
import { clockText, linkHost, postedText } from "../../content/format";
import { useClock } from "../../content/useClock";
import { useLoaded } from "../../content/useLoaded";
import { httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { ContentNotice } from "../ContentNotice";
import { CLOCK_LABEL, EDITOR_HINT, EMPTY, LINK_LABEL, PINNED } from "./consts";
import * as styles from "./styles";
import type { ComputerScreenProps } from "./types";

/** What a desk computer shows: the room, the time, and the announcements of the floor (the pinned first). */
export function ComputerScreen({
  floor,
  getToken,
  canEdit,
}: ComputerScreenProps) {
  const [{ request, base }] = useState(() => ({
    request: withToken(getToken),
    base: httpUrlOf(currentServerUrl()),
  }));
  const now = useClock();
  const { state, retry } = useLoaded(
    () => contentCache.floorContent(request, base, floor.id),
    floor.id,
  );

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span className={styles.room}>{floor.name}</span>
        <time
          className={styles.clock}
          dateTime={now.toISOString()}
          aria-label={CLOCK_LABEL}
        >
          {clockText(now)}
        </time>
      </div>
      {state.status !== "ready" ? (
        <ContentNotice state={state} onRetry={retry} />
      ) : state.value.content.announcements.length === 0 ? (
        <>
          <p className={styles.empty}>{EMPTY}</p>
          {canEdit && <p className={styles.hint}>{EDITOR_HINT}</p>}
        </>
      ) : (
        <ul className={styles.list}>
          {orderAnnouncements(state.value.content.announcements).map(
            (announcement) => (
              <li key={announcement.id}>
                <Card variant="secondary">
                  <Card.Header>
                    <Card.Title className={styles.itemTitle}>
                      {announcement.title}
                      {announcement.pinned && (
                        <Chip size="sm" color="accent">
                          {PINNED}
                        </Chip>
                      )}
                      <span className={styles.date}>
                        {postedText(announcement.updatedAt)}
                      </span>
                    </Card.Title>
                  </Card.Header>
                  {(announcement.body || announcement.link) && (
                    <Card.Content>
                      {announcement.body && (
                        <p className={styles.text}>{announcement.body}</p>
                      )}
                      {announcement.link && (
                        <Link
                          href={announcement.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {LINK_LABEL(linkHost(announcement.link))}
                        </Link>
                      )}
                    </Card.Content>
                  )}
                </Card>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
