import { Button, Link } from "@heroui/react";
import { contentCache } from "../../content/content";
import { linkHost } from "../../content/format";
import { useLoaded } from "../../content/useLoaded";
import { ContentNotice } from "../ContentNotice";
import { BACK, BY, LINK_LABEL, NO_TEXT } from "./consts";
import * as styles from "./styles";
import type { BookReaderProps } from "./types";

/** One book: its text as plain text with its line breaks, and a way back to the shelf. */
export function BookReader({
  floor,
  id,
  request,
  base,
  onBack,
}: BookReaderProps) {
  const { state, retry } = useLoaded(
    () => contentCache.book(request, base, floor, id),
    `${floor}\n${id}`,
  );
  return (
    <div className={styles.reader}>
      <div className={styles.readerHeader}>
        <div>
          {state.status === "ready" && (
            <>
              <h3 className={styles.readerTitle}>{state.value.book.title}</h3>
              {state.value.book.author && (
                <p className={styles.readerAuthor}>
                  {BY(state.value.book.author)}
                </p>
              )}
            </>
          )}
        </div>
        <Button size="sm" variant="secondary" onPress={onBack}>
          {BACK}
        </Button>
      </div>
      {state.status !== "ready" ? (
        <ContentNotice state={state} onRetry={retry} />
      ) : (
        <>
          {state.value.book.body ? (
            <p className={styles.pages}>{state.value.book.body}</p>
          ) : (
            <p className={styles.noText}>{NO_TEXT}</p>
          )}
          {state.value.book.link && (
            <Link
              href={state.value.book.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {LINK_LABEL(linkHost(state.value.book.link))}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
