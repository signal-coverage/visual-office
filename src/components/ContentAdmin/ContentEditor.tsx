import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import type { ContentFields, ContentKind } from "../../../shared/content.ts";
import { limitOf, validateForm, type ContentForm } from "../../content/form";
import { COUNTER, EDITOR } from "./consts";
import * as styles from "./styles";

export interface ContentEditorProps {
  kind: ContentKind;
  initial: ContentForm;
  /** A new one, or a change to an existing one: the heading says which. */
  isNew: boolean;
  busy: boolean;
  /** What the server said when it did not save, in its words. */
  error: string | null;
  /** Called with the checked, cleaned words: only when they pass the limits. */
  onSave: (fields: ContentFields) => void;
  onCancel: () => void;
}

/** The form for one book or announcement, with the same checks the server makes. */
export function ContentEditor({
  kind,
  initial,
  isNew,
  busy,
  error,
  onSave,
  onCancel,
}: ContentEditorProps) {
  const [form, setForm] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const checked = validateForm(kind, form);
  const errors = attempted && !checked.ok ? checked.errors : {};
  const change = <K extends keyof ContentForm>(key: K, value: ContentForm[K]) =>
    setForm((now) => ({ ...now, [key]: value }));
  const save = () => {
    setAttempted(true);
    if (checked.ok) onSave(checked.fields);
  };
  const heading =
    kind === "book"
      ? isNew
        ? EDITOR.newBook
        : EDITOR.editBook
      : isNew
        ? EDITOR.newAnnouncement
        : EDITOR.editAnnouncement;

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && !busy && onCancel()}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className={styles.dialog} aria-label={heading}>
          <Modal.Header>
            <Modal.Heading className={styles.title}>{heading}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className={styles.form}>
            <TextField
              className={styles.field}
              value={form.title}
              isInvalid={!!errors.title}
              autoFocus
              onChange={(next) => change("title", next)}
            >
              <Label>{EDITOR.title}</Label>
              <Input fullWidth autoComplete="off" />
              <Description className={styles.counter}>
                {COUNTER(form.title.length, limitOf(kind, "title"))}
              </Description>
              <FieldError>{errors.title}</FieldError>
            </TextField>
            {kind === "book" && (
              <TextField
                className={styles.field}
                value={form.author}
                isInvalid={!!errors.author}
                onChange={(next) => change("author", next)}
              >
                <Label>{EDITOR.author}</Label>
                <Input fullWidth autoComplete="off" />
                <Description className={styles.counter}>
                  {COUNTER(form.author.length, limitOf(kind, "author"))}
                </Description>
                <FieldError>{errors.author}</FieldError>
              </TextField>
            )}
            <TextField
              className={styles.field}
              value={form.body}
              isInvalid={!!errors.body}
              onChange={(next) => change("body", next)}
            >
              <Label>
                {kind === "book" ? EDITOR.bookBody : EDITOR.announcementBody}
              </Label>
              <TextArea fullWidth rows={kind === "book" ? 10 : 5} />
              <Description className={styles.counter}>
                {COUNTER(form.body.length, limitOf(kind, "body"))}
              </Description>
              <FieldError>{errors.body}</FieldError>
            </TextField>
            <TextField
              className={styles.field}
              value={form.link}
              isInvalid={!!errors.link}
              onChange={(next) => change("link", next)}
            >
              <Label>{EDITOR.link}</Label>
              <Input
                fullWidth
                autoComplete="off"
                placeholder={EDITOR.linkPlaceholder}
              />
              <Description>{EDITOR.linkHint}</Description>
              <FieldError>{errors.link}</FieldError>
            </TextField>
            {kind === "announcement" && (
              <Switch
                isSelected={form.pinned}
                onChange={(next) => change("pinned", next)}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>{EDITOR.pinned}</Switch.Content>
              </Switch>
            )}
            {errors.form && (
              <p className={styles.result(false)} role="alert">
                {errors.form}
              </p>
            )}
            {error && (
              <p className={styles.result(false)} role="alert">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className={styles.actions}>
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
