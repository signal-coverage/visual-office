import {
  Button,
  Checkbox,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { MAX_GROUP_NAME_LENGTH } from "../../../shared/groups.ts";
import type { AdminFloor } from "../../floors/floors";
import {
  draftOf,
  EMPTY_NAME_ERROR,
  filterPeople,
  NAME_TAKEN_ERROR,
  NAME_TOO_LONG_ERROR,
  roomChoices,
  validateGroupForm,
  type GroupDraft,
} from "../../groups/form";
import type { Group, GroupLimits } from "../../groups/groups";
import type { Person } from "../../people/people";
import { EDITOR, roomsCount, selectedCount } from "./consts";
import * as styles from "./styles";

export interface GroupEditorProps {
  /** The group being edited, or null for a new one. */
  group: Group | null;
  /** Every group (to refuse a name that is taken) and the limits. */
  groups: readonly Group[];
  limits: GroupLimits;
  rooms: readonly AdminFloor[];
  people: readonly Person[];
  busy: boolean;
  /** What the server said when it did not save, in its words. */
  error: string | null;
  /** Called with the checked draft (the name already cleaned): only when it passes the limits. */
  onSave: (draft: GroupDraft) => void;
  onCancel: () => void;
}

const NAME_ERRORS = [EMPTY_NAME_ERROR, NAME_TOO_LONG_ERROR, NAME_TAKEN_ERROR];

const toggle = (list: readonly string[], id: string, on: boolean) =>
  on
    ? [...list.filter((entry) => entry !== id), id]
    : list.filter((entry) => entry !== id);

/** The form of one group: its name, the rooms it opens and the people in it. Nothing is saved until Save. */
export function GroupEditor({
  group,
  groups,
  limits,
  rooms,
  people,
  busy,
  error,
  onSave,
  onCancel,
}: GroupEditorProps) {
  const [draft, setDraft] = useState(() => draftOf(group));
  const [search, setSearch] = useState("");
  const [attempted, setAttempted] = useState(false);
  const checked = validateGroupForm(draft, {
    groups,
    limits,
    currentId: group?.id ?? null,
  });
  const problem = attempted && !checked.ok ? checked.error : undefined;
  const nameError =
    problem && NAME_ERRORS.includes(problem) ? problem : undefined;
  const choices = roomChoices(rooms, draft.floors);
  const shown = filterPeople(people, search);

  const save = () => {
    setAttempted(true);
    if (checked.ok) onSave({ ...draft, name: checked.name });
  };
  const heading = group ? EDITOR.editTitle : EDITOR.newTitle;

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && !busy && onCancel()}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className={styles.dialog} aria-label={heading}>
          <Modal.Header>
            <Modal.Heading className={styles.dialogTitle}>
              {heading}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className={styles.form}>
            <TextField
              className={styles.field}
              value={draft.name}
              isInvalid={!!nameError}
              autoFocus
              onChange={(name) => setDraft((now) => ({ ...now, name }))}
            >
              <Label>{EDITOR.name}</Label>
              <Input
                fullWidth
                autoComplete="off"
                placeholder={EDITOR.namePlaceholder}
              />
              <Description className={styles.counter}>
                {draft.name.length} / {MAX_GROUP_NAME_LENGTH}
              </Description>
              <FieldError>{nameError}</FieldError>
            </TextField>

            <section className={styles.section} aria-label={EDITOR.rooms}>
              <h3 className={styles.sectionTitle}>{EDITOR.rooms}</h3>
              <p className={styles.counter}>
                {EDITOR.roomsHint}{" "}
                {roomsCount(draft.floors.length, limits.floors)}
              </p>
              {choices.length === 0 ? (
                <p className={styles.counter}>{EDITOR.noRooms}</p>
              ) : (
                <div
                  className={styles.checkList}
                  role="group"
                  aria-label={EDITOR.rooms}
                >
                  {choices.map((room) => (
                    <Checkbox
                      className={styles.check}
                      key={room.id}
                      isSelected={draft.floors.includes(room.id)}
                      onChange={(on) =>
                        setDraft((now) => ({
                          ...now,
                          floors: toggle(now.floors, room.id, on),
                        }))
                      }
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>
                          {room.name}
                          {room.archived ? ` (${EDITOR.archived})` : ""}
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.section} aria-label={EDITOR.people}>
              <h3 className={styles.sectionTitle}>{EDITOR.people}</h3>
              <TextField
                className={styles.field}
                value={search}
                onChange={setSearch}
                aria-label={EDITOR.search}
              >
                <Input
                  fullWidth
                  autoComplete="off"
                  placeholder={EDITOR.searchPlaceholder}
                />
              </TextField>
              <p className={styles.counter}>
                {selectedCount(draft.members.length, limits.members)}
              </p>
              {people.length === 0 ? (
                <p className={styles.counter}>{EDITOR.noPeople}</p>
              ) : shown.length === 0 ? (
                <p className={styles.counter}>{EDITOR.noMatches}</p>
              ) : (
                <div
                  className={styles.checkList}
                  role="group"
                  aria-label={EDITOR.people}
                >
                  {shown.map((person) => (
                    <Checkbox
                      className={styles.check}
                      key={person.id}
                      isSelected={draft.members.includes(person.id)}
                      onChange={(on) =>
                        setDraft((now) => ({
                          ...now,
                          members: toggle(now.members, person.id, on),
                        }))
                      }
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <div className={styles.personText}>
                          <Label>{person.name}</Label>
                          {person.email && (
                            <Description>{person.email}</Description>
                          )}
                        </div>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
              )}
            </section>

            {error && (
              <p className={styles.result(false)} role="alert">
                {error}
              </p>
            )}
            {problem && !nameError && (
              <p className={styles.result(false)} role="alert">
                {problem}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className={styles.footer}>
            <Button variant="secondary" isDisabled={busy} onPress={onCancel}>
              {EDITOR.cancel}
            </Button>
            <Button isDisabled={busy} onPress={save}>
              {busy ? EDITOR.saving : EDITOR.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
