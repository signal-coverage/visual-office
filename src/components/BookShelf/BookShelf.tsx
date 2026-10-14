import { Button } from "@heroui/react";
import { useState } from "react";
import { withToken } from "../../calendar/calendar";
import { contentCache } from "../../content/content";
import { useLoaded } from "../../content/useLoaded";
import { httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { ContentNotice } from "../ContentNotice";
import { BookReader } from "./BookReader";
import { BY, EDITOR_HINT, EMPTY, PICK } from "./consts";
import * as styles from "./styles";
import type { BookShelfProps } from "./types";

/** What a bookshelf offers: the books of the floor to choose from, and one at a time to read. */
export function BookShelf({ floor, getToken, canEdit }: BookShelfProps) {
  const [{ request, base }] = useState(() => ({
    request: withToken(getToken),
    base: httpUrlOf(currentServerUrl()),
  }));
  const [reading, setReading] = useState<string | null>(null);
  const { state, retry } = useLoaded(
    () => contentCache.floorContent(request, base, floor.id),
    floor.id,
  );

  if (reading !== null)
    return (
      <BookReader
        floor={floor.id}
        id={reading}
        request={request}
        base={base}
        onBack={() => setReading(null)}
      />
    );
  if (state.status !== "ready")
    return <ContentNotice state={state} onRetry={retry} />;

  const { books } = state.value.content;
  if (books.length === 0)
    return (
      <div className={styles.shelf}>
        <p className={styles.empty}>{EMPTY}</p>
        {canEdit && <p className={styles.hint}>{EDITOR_HINT}</p>}
      </div>
    );
  return (
    <div className={styles.shelf}>
      <p className={styles.pick}>{PICK}</p>
      <ul className={styles.list}>
        {books.map((book) => (
          <li key={book.id}>
            <Button
              variant="secondary"
              fullWidth
              className={styles.book}
              onPress={() => setReading(book.id)}
            >
              <span className={styles.bookText}>
                <span className={styles.bookTitle}>{book.title}</span>
                {book.author && (
                  <span className={styles.bookAuthor}>{BY(book.author)}</span>
                )}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
