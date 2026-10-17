import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import {
  MAX_FLOOR_NAME_LENGTH,
  sanitizeFloorName,
} from "../../../shared/floors.ts";
import type { AdminFloor } from "../../floors/floors";
import { EMPTY_NAME, RENAME } from "./consts";
import * as styles from "./styles";

export interface RoomRenameProps {
  room: AdminFloor;
  busy: boolean;
  /** What the server said when it did not rename, in its words. */
  error: string | null;
  /** Called with the cleaned name, only when there is one. */
  onSave: (name: string) => void;
  onCancel: () => void;
}

/** A small form to give a room another name. The id (and so every link and entry) stays. */
export function RoomRename({
  room,
  busy,
  error,
  onSave,
  onCancel,
}: RoomRenameProps) {
  const [name, setName] = useState(room.name);
  const [attempted, setAttempted] = useState(false);
  const clean = sanitizeFloorName(name);
  const problem = attempted && !clean ? EMPTY_NAME : undefined;

  const save = () => {
    setAttempted(true);
    if (clean) onSave(clean);
  };

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && !busy && onCancel()}
    >
      <Modal.Container>
        <Modal.Dialog className={styles.renameDialog} aria-label={RENAME.title}>
          <Modal.Header>
            <Modal.Heading className={styles.title}>
              {RENAME.title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className={styles.renameForm}>
            <TextField
              className={styles.field}
              value={name}
              isInvalid={!!problem}
              autoFocus
              onChange={setName}
            >
              <Label>{RENAME.name}</Label>
              <Input
                fullWidth
                maxLength={MAX_FLOOR_NAME_LENGTH}
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
              />
              <Description>{RENAME.hint}</Description>
              <FieldError>{problem}</FieldError>
            </TextField>
            {error && (
              <p className={styles.result(false)} role="alert">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className={styles.footer}>
            <Button variant="secondary" isDisabled={busy} onPress={onCancel}>
              {RENAME.cancel}
            </Button>
            <Button isDisabled={busy} onPress={save}>
              {busy ? RENAME.saving : RENAME.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
