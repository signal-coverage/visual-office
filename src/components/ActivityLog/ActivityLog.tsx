import { Button, Table } from "@heroui/react";
import { useEffect, useState } from "react";
import { describeAudit, type AuditEntry } from "../../../shared/audit.ts";
import { FLOOR_ID } from "../../../shared/floors.ts";
import { fetchAudit, mergeEntries } from "../../audit/audit";
import { gameBackend, httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import {
  CLOSE_LABEL,
  EMPTY,
  INTRO,
  LOAD_ERROR,
  LOAD_MORE_ERROR,
  LOAD_MORE_LABEL,
  LOADING,
  LOADING_MORE_LABEL,
  TITLE,
  WHAT_LABEL,
  WHEN_LABEL,
} from "./consts";
import * as styles from "./styles";
import type { ActivityLogProps } from "./types";

/**
 * The activity log, for the admins: who did what, newest first, a page at a
 * time. The game server checks that this person is an admin on every call,
 * whatever this screen shows.
 */
export function ActivityLog({ getToken, onClose }: ActivityLogProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: gameBackend({
      serverUrl: currentServerUrl(),
      floor: FLOOR_ID,
      getToken,
      models: [],
    }).request,
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  useEffect(() => {
    void fetchAudit(request, adminBase).then((page) => {
      setEntries(page?.entries ?? null);
      setNextBefore(page?.nextBefore ?? null);
      setLoaded(true);
    });
  }, [request, adminBase]);

  const loadMore = async () => {
    if (nextBefore === null) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const page = await fetchAudit(request, adminBase, nextBefore);
    setLoadingMore(false);
    if (!page) {
      setMoreFailed(true);
      return;
    }
    setEntries((shown) => mergeEntries(shown ?? [], page.entries));
    setNextBefore(page.nextBefore);
  };

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <Button variant="secondary" size="sm" onPress={onClose}>
          {CLOSE_LABEL}
        </Button>
        <h1 className={styles.title}>{TITLE}</h1>
      </header>
      <main className={styles.body}>
        <p className={styles.intro}>{INTRO}</p>
        {!loaded && <p className={styles.notice(false)}>{LOADING}</p>}
        {loaded && !entries && (
          <p className={styles.notice(true)} role="alert">
            {LOAD_ERROR}
          </p>
        )}
        {entries && entries.length === 0 && (
          <p className={styles.notice(false)}>{EMPTY}</p>
        )}
        {entries && entries.length > 0 && (
          <Table className={styles.table}>
            <Table.ScrollContainer>
              <Table.Content aria-label={TITLE}>
                <Table.Header>
                  <Table.Column id="when">{WHEN_LABEL}</Table.Column>
                  <Table.Column id="what" isRowHeader>
                    {WHAT_LABEL}
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {entries.map((entry) => (
                    <Table.Row key={entry.id} id={String(entry.id)}>
                      <Table.Cell>
                        <time
                          className={styles.when}
                          dateTime={new Date(entry.at).toISOString()}
                        >
                          {new Date(entry.at).toLocaleString()}
                        </time>
                      </Table.Cell>
                      <Table.Cell>{describeAudit(entry)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
        {moreFailed && (
          <p className={styles.notice(true)} role="alert">
            {LOAD_MORE_ERROR}
          </p>
        )}
        {nextBefore !== null && (
          <div className={styles.more}>
            <Button
              variant="secondary"
              isDisabled={loadingMore}
              onPress={() => void loadMore()}
            >
              {loadingMore ? LOADING_MORE_LABEL : LOAD_MORE_LABEL}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
