import {
  Button,
  Checkbox,
  Chip,
  Label,
  NumberField,
  Table,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { COMMON_FLOOR_ID } from "../../../shared/floors.ts";
import {
  banMinutes,
  DEFAULT_BAN_MINUTES,
  MAX_BAN_MINUTES,
  MIN_BAN_MINUTES,
  type ModerationAction,
} from "../../../shared/moderation.ts";
import { gameBackend, httpUrlOf } from "../../editor/backend";
import { setFloorAccess } from "../../floors/floors";
import { currentServerUrl } from "../../game/serverAddress";
import {
  canEnterFloor,
  entryIsFixed,
  fetchPeople,
  moderatePerson,
  setHead,
  withAccess,
  withHead,
  type PeopleList,
} from "../../people/people";
import { confirmQuestion, needsConfirmation } from "../ModerationPanel/helpers";
import {
  ADMIN_BADGE,
  BAN_LABEL,
  BAN_LENGTH_LABEL,
  bannedUntilText,
  CANCEL_LABEL,
  CLOSE_LABEL,
  CONFIRM_LABEL,
  headColumn,
  enterColumn,
  enterLabel,
  headLabel,
  ALWAYS_NOTE,
  EMPTY,
  INTRO,
  KICK_LABEL,
  LOAD_ERROR,
  LOADING,
  MODERATION_COLUMN,
  MODERATION_INTRO,
  MUTE_LABEL,
  SAVE_ERROR,
  TITLE,
  UNBAN_LABEL,
  UNMUTE_LABEL,
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
      floor: COMMON_FLOOR_ID,
      getToken,
      models: [],
    }).request,
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [list, setList] = useState<PeopleList | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(DEFAULT_BAN_MINUTES);
  const [pending, setPending] = useState<{
    id: string;
    action: ModerationAction;
  } | null>(null);
  /** What the last moderation action came to: shown until the next one. */
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

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

  const toggleAccess = async (
    userId: string,
    floor: string,
    allowed: boolean,
  ) => {
    if (!list) return;
    setProblem(null);
    // Shown at once; put back if the server did not do it
    setList({
      ...list,
      people: withAccess(list.people, userId, floor, allowed),
    });
    if (!(await setFloorAccess(request, adminBase, floor, userId, allowed))) {
      setList((now) =>
        now
          ? {
              ...now,
              people: withAccess(now.people, userId, floor, !allowed),
            }
          : now,
      );
      setProblem(SAVE_ERROR);
    }
  };

  const moderate = async (action: ModerationAction, userId: string) => {
    setPending(null);
    setResult(
      await moderatePerson(
        request,
        adminBase,
        action,
        userId,
        action === "ban" ? banMinutes(minutes) : undefined,
      ),
    );
    // A ban or a lifted ban changes what the list says about them
    if (action === "ban" || action === "unban")
      void fetchPeople(request, adminBase).then(
        (found) => found && setList(found),
      );
  };

  const ask = (action: ModerationAction, userId: string) => {
    if (needsConfirmation(action)) setPending({ id: userId, action });
    else void moderate(action, userId);
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
        {result && (
          <p className={styles.notice(!result.ok)} role="status">
            {result.text}
          </p>
        )}
        {list && list.people.length > 0 && (
          <>
            <p className={styles.intro}>{MODERATION_INTRO}</p>
            <NumberField
              className={styles.banLength}
              value={minutes}
              minValue={MIN_BAN_MINUTES}
              maxValue={MAX_BAN_MINUTES}
              onChange={(next) => {
                if (Number.isFinite(next)) setMinutes(next);
              }}
            >
              <Label>{BAN_LENGTH_LABEL}</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
          </>
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
                  {list.floorInfo.map((floor) => (
                    <Table.Column key={floor.id} id={floor.id}>
                      {headColumn(floor.name)}
                    </Table.Column>
                  ))}
                  {list.floorInfo.map((floor) => (
                    <Table.Column
                      key={`enter-${floor.id}`}
                      id={`enter-${floor.id}`}
                    >
                      {enterColumn(floor.name)}
                    </Table.Column>
                  ))}
                  <Table.Column id="moderation">
                    {MODERATION_COLUMN}
                  </Table.Column>
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
                      {list.floorInfo.map((floor) => (
                        <Table.Cell key={floor.id}>
                          <Checkbox
                            aria-label={headLabel(person.name, floor.name)}
                            isSelected={person.headOf.includes(floor.id)}
                            onChange={(head) =>
                              void toggle(person.id, floor.id, head)
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
                      {list.floorInfo.map((floor) => (
                        <Table.Cell key={`enter-${floor.id}`}>
                          <Checkbox
                            aria-label={enterLabel(person.name, floor.name)}
                            isSelected={canEnterFloor(person, floor)}
                            isDisabled={entryIsFixed(person, floor)}
                            onChange={(allowed) =>
                              void toggleAccess(person.id, floor.id, allowed)
                            }
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                          {entryIsFixed(person, floor) && (
                            <span className={styles.always}>{ALWAYS_NOTE}</span>
                          )}
                        </Table.Cell>
                      ))}
                      <Table.Cell>
                        {person.isAdmin ? null : pending?.id === person.id ? (
                          <div className={styles.moderation}>
                            <p className={styles.question}>
                              {confirmQuestion(
                                pending.action,
                                person.name,
                                banMinutes(minutes),
                              )}
                            </p>
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() =>
                                void moderate(pending.action, person.id)
                              }
                            >
                              {CONFIRM_LABEL}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => setPending(null)}
                            >
                              {CANCEL_LABEL}
                            </Button>
                          </div>
                        ) : (
                          <div className={styles.moderation}>
                            {person.bannedUntil ? (
                              <>
                                <span className={styles.banned}>
                                  {bannedUntilText(person.bannedUntil)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => ask("unban", person.id)}
                                >
                                  {UNBAN_LABEL}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="danger-soft"
                                onPress={() => ask("ban", person.id)}
                              >
                                {BAN_LABEL}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => ask("kick", person.id)}
                            >
                              {KICK_LABEL}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => ask("mute", person.id)}
                            >
                              {MUTE_LABEL}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => ask("unmute", person.id)}
                            >
                              {UNMUTE_LABEL}
                            </Button>
                          </div>
                        )}
                      </Table.Cell>
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
