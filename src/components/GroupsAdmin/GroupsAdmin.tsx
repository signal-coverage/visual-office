import { Button, Chip, Table } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { withToken } from "../../calendar/calendar";
import { httpUrlOf } from "../../editor/backend";
import { fetchRoomsAdmin, type AdminFloor } from "../../floors/floors";
import { currentServerUrl } from "../../game/serverAddress";
import { planChanges, type GroupDraft } from "../../groups/form";
import {
  applyChanges,
  createGroup,
  deleteGroup,
  fetchGroups,
  type Group,
  type GroupList,
} from "../../groups/groups";
import { fetchPeople, type Person } from "../../people/people";
import { GroupEditor } from "./GroupEditor";
import {
  CANCEL_LABEL,
  CLOSE_LABEL,
  COLUMNS,
  CONFIRM_LABEL,
  confirmDelete,
  DELETE_ERROR,
  DELETE_LABEL,
  DELETED,
  EDIT_LABEL,
  EMPTY,
  INTRO,
  LOAD_ERROR,
  LOADING,
  NEW_LABEL,
  NO_ROOMS,
  partialSave,
  peopleCount,
  SAVED,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { GroupsAdminProps } from "./types";

/** Where a group is being edited: a new one (null) or one that exists. */
type Editing = { group: Group | null };

/**
 * The role groups, for the admins: a name, the rooms it opens and the people in
 * it. Giving a group a room is giving it to all its people, so nobody is ticked
 * one by one. The game server checks that the caller is an admin on every call,
 * whatever this screen shows.
 */
export function GroupsAdmin({ getToken, onClose }: GroupsAdminProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: withToken(getToken),
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [list, setList] = useState<GroupList | null>(null);
  const [rooms, setRooms] = useState<AdminFloor[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const reload = useCallback(async () => {
    const found = await fetchGroups(request, adminBase);
    if (found) setList(found);
    return found;
  }, [request, adminBase]);

  useEffect(() => {
    void Promise.all([
      fetchGroups(request, adminBase),
      fetchRoomsAdmin(request, adminBase),
      fetchPeople(request, adminBase),
    ]).then(([groups, found, who]) => {
      setList(groups);
      setRooms(found?.floors ?? []);
      setPeople(who?.people ?? []);
      setLoaded(true);
    });
  }, [request, adminBase]);

  const nameOfRoom = (id: string) =>
    rooms.find((room) => room.id === id)?.name ?? id;

  const save = async (draft: GroupDraft) => {
    if (!editing || !list) return;
    setBusy(true);
    setEditorError(null);
    let target = editing.group;
    if (!target) {
      const made = await createGroup(request, adminBase, draft.name);
      if (!made.ok) {
        setBusy(false);
        setEditorError(made.text);
        return;
      }
      target = made.group;
    }
    const changes = planChanges(editing.group ? target : null, draft);
    const applied = await applyChanges(request, adminBase, target.id, changes);
    const found = await reload();
    setBusy(false);
    if (applied.ok) {
      setEditing(null);
      setResult({ ok: true, text: SAVED(draft.name) });
      return;
    }
    // Part of it was made: the editor goes on with the group as it is now
    setEditing({
      group: found?.groups.find((group) => group.id === target.id) ?? target,
    });
    setEditorError(partialSave(applied.done, changes.length, applied.text));
  };

  const remove = async (group: Group) => {
    setConfirming(null);
    const outcome = await deleteGroup(request, adminBase, group.id);
    if (outcome.ok) {
      await reload();
      setResult({ ok: true, text: DELETED(group.name) });
    } else {
      setResult({ ok: false, text: outcome.text || DELETE_ERROR });
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <Button variant="secondary" size="sm" onPress={onClose}>
          {CLOSE_LABEL}
        </Button>
        <h1 className={styles.title}>{TITLE}</h1>
        <span className={styles.spacer} />
        <Button
          size="sm"
          isDisabled={!list}
          onPress={() => {
            setResult(null);
            setEditorError(null);
            setEditing({ group: null });
          }}
        >
          {NEW_LABEL}
        </Button>
      </header>
      <main className={styles.body}>
        <p className={styles.intro}>{INTRO}</p>
        {!loaded && <p className={styles.notice(false)}>{LOADING}</p>}
        {loaded && !list && (
          <p className={styles.notice(true)} role="alert">
            {LOAD_ERROR}
          </p>
        )}
        {result && (
          <p className={styles.notice(!result.ok)} role="status">
            {result.text}
          </p>
        )}
        {list && list.groups.length === 0 && (
          <p className={styles.notice(false)}>{EMPTY}</p>
        )}
        {list && list.groups.length > 0 && (
          <Table className={styles.table}>
            <Table.ScrollContainer>
              <Table.Content aria-label={TITLE}>
                <Table.Header>
                  <Table.Column id="name" isRowHeader>
                    {COLUMNS.name}
                  </Table.Column>
                  <Table.Column id="rooms">{COLUMNS.rooms}</Table.Column>
                  <Table.Column id="people">{COLUMNS.people}</Table.Column>
                  <Table.Column id="actions" className="text-end">
                    {COLUMNS.actions}
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {list.groups.map((group) => (
                    <Table.Row key={group.id} id={group.id}>
                      <Table.Cell>
                        <span className={styles.groupName}>{group.name}</span>
                      </Table.Cell>
                      <Table.Cell>
                        {group.floors.length === 0 ? (
                          <span className={styles.small}>{NO_ROOMS}</span>
                        ) : (
                          <div className={styles.chips}>
                            {group.floors.map((floor) => (
                              <Chip key={floor} size="sm">
                                {nameOfRoom(floor)}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <span className={styles.small}>
                          {peopleCount(group.members.length)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {confirming === group.id ? (
                          <div className={styles.actions}>
                            <p className={styles.question}>
                              {confirmDelete(group.name)}
                            </p>
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() => void remove(group)}
                            >
                              {CONFIRM_LABEL}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => setConfirming(null)}
                            >
                              {CANCEL_LABEL}
                            </Button>
                          </div>
                        ) : (
                          <div className={styles.actions}>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => {
                                setResult(null);
                                setEditorError(null);
                                setEditing({ group });
                              }}
                            >
                              {EDIT_LABEL}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger-soft"
                              onPress={() => setConfirming(group.id)}
                            >
                              {DELETE_LABEL}
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
      {editing && list && (
        <GroupEditor
          key={editing.group?.id ?? "new"}
          group={editing.group}
          groups={list.groups}
          limits={list.limits}
          rooms={rooms}
          people={people}
          busy={busy}
          error={editorError}
          onSave={(draft) => void save(draft)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
