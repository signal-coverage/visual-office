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
import { SHELL_LIMITS } from "../../../shared/shell.ts";
import { COPY } from "./consts";
import * as styles from "./styles";
import type { NameModalProps } from "./types";

/** Asks what to call a new private room or area. It does not close until the name is one the shell can take. */
export function NameModal({
  kind,
  validate,
  onSubmit,
  onCancel,
}: NameModalProps) {
  const [name, setName] = useState("");
  const [attempted, setAttempted] = useState(false);
  const copy = COPY[kind];
  const problem = attempted ? validate(name) : null;

  const submit = () => {
    setAttempted(true);
    if (validate(name) === null) onSubmit(name);
  };

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && onCancel()}
    >
      <Modal.Container>
        <Modal.Dialog className={styles.dialog} aria-label={copy.title}>
          <Modal.Header>
            <Modal.Heading className={styles.title}>{copy.title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className={styles.body}>
            <TextField
              className={styles.field}
              value={name}
              isInvalid={!!problem}
              autoFocus
              onChange={(next) => {
                setName(next);
                setAttempted(false);
              }}
            >
              <Label>Name</Label>
              <Input
                fullWidth
                maxLength={SHELL_LIMITS.labelLength}
                placeholder={copy.placeholder}
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
              <Description>{copy.hint}</Description>
              <FieldError>{problem}</FieldError>
            </TextField>
          </Modal.Body>
          <Modal.Footer className={styles.footer}>
            <Button variant="secondary" onPress={onCancel}>
              Cancel
            </Button>
            <Button onPress={submit}>{copy.confirm}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
