import { Button, Checkbox, Chip, Table } from "@heroui/react";
import { useEffect, useState } from "react";
import { FLOOR_ID } from "../../../shared/floors.ts";
import { gameBackend, httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import {
  fetchPeople,
  setHead,
  withHead,
  type PeopleList,
} from "../../people/people";
import {
  ADMIN_BADGE,
  CLOSE_LABEL,
  EMPTY,
  INTRO,
  LOAD_ERROR,
  LOADING,
  SAVE_ERROR,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { PeopleAdminProps } from "./types";

/**
 * Who has signed in, and who is head of which floor, for the admins. A head
 * can edit their floor's layout; the game server checks that this person is an
 * admin on every call, whatever this screen shows.
 */
export function PeopleAdmin({ getToken, onClose }: PeopleAdminProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: gameBackend({
      serverUrl: currentServerUrl(),
      floor: FLOOR_ID,
      getToken,
      models: [],
    }).request,
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [list, setList] = useState<PeopleList | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void fetchPeople(request, adminBase).then((found) => {
      setList(found);
      setLoaded(true);
    });
  }, [request, adminBase]);

  const toggle = async (userId: string, floor: string, head: boolean) => {
    if (!list) return;
    setProblem(null);
    // Shown at once; put back if the server did not do it
    setList({ ...list, people: withHead(list.people, userId, floor, head) });
    if (!(await setHead(request, adminBase, floor, userId, head))) {
      setList((now) =>
        now
          ? { ...now, people: withHead(now.people, userId, floor, !head) }
          : now,
      );
      setProblem(SAVE_ERROR);
    }
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
        {loaded && !list && (
          <p className={styles.notice(true)} role="alert">
            {LOAD_ERROR}
          </p>
        )}
        {problem && (
          <p className={styles.notice(true)} role="alert">
            {problem}
          </p>
        )}
        {list && list.people.length === 0 && (
          <p className={styles.notice(false)}>{EMPTY}</p>
        )}
        {list && list.people.length > 0 && (
          <Table className={styles.table}>
            <Table.ScrollContainer>
              <Table.Content aria-label={TITLE}>
                <Table.Header>
                  <Table.Column id="person" isRowHeader>
                    Person
                  </Table.Column>
                  {list.floors.map((floor) => (
                    <Table.Column key={floor} id={floor}>
                      Head of {floor}
                    </Table.Column>
                  ))}
                </Table.Header>
                <Table.Body>
                  {list.people.map((person) => (
                    <Table.Row key={person.id} id={person.id}>
                      <Table.Cell>
                        {person.name}
                        {person.isAdmin && (
                          <Chip
                            size="sm"
                            color="accent"
                            className={styles.badge}
                          >
                            {ADMIN_BADGE}
                          </Chip>
                        )}
                        {person.email && (
                          <div className={styles.email}>{person.email}</div>
                        )}
                      </Table.Cell>
                      {list.floors.map((floor) => (
                        <Table.Cell key={floor}>
                          <Checkbox
                            aria-label={`${person.name} is head of ${floor}`}
                            isSelected={person.headOf.includes(floor)}
                            onChange={(head) =>
                              void toggle(person.id, floor, head)
                            }
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </main>
    </div>
  );
}
