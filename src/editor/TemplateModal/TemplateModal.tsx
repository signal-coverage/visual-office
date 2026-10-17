import {
  Button,
  Checkbox,
  Description,
  Label,
  ListBox,
  Modal,
  Select,
} from "@heroui/react";
import { useState } from "react";
import {
  CONFIRM,
  DRAFT_NOTE,
  FURNITURE_LABEL,
  FURNITURE_NOTE,
  TITLE,
  WARNING,
} from "./consts";
import * as styles from "./styles";
import type { TemplateModalProps } from "./types";

/** Asks which template to start the structure again from, and says plainly that it replaces what is there. */
export function TemplateModal({
  templates,
  onApply,
  onCancel,
}: TemplateModalProps) {
  const [id, setId] = useState(templates[0]?.id ?? "");
  const [furniture, setFurniture] = useState(true);
  const chosen = templates.find((template) => template.id === id);

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && onCancel()}
    >
      <Modal.Container>
        <Modal.Dialog className={styles.dialog} aria-label={TITLE}>
          <Modal.Header>
            <Modal.Heading className={styles.title}>{TITLE}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className={styles.body}>
            <p className={styles.warning} role="alert">
              {WARNING}
            </p>
            <p className={styles.note}>{DRAFT_NOTE}</p>
            <Select
              className={styles.field}
              aria-label="Template"
              value={id}
              onChange={(next) => {
                if (typeof next === "string") setId(next);
              }}
            >
              <Label>Template</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {templates.map((template) => (
                    <ListBox.Item
                      key={template.id}
                      id={template.id}
                      textValue={template.name}
                    >
                      <div className={styles.templateText}>
                        <Label>{template.name}</Label>
                        <Description>{template.description}</Description>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              {chosen && <Description>{chosen.description}</Description>}
            </Select>
            <Checkbox isSelected={furniture} onChange={setFurniture}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label>{FURNITURE_LABEL}</Label>
              </Checkbox.Content>
            </Checkbox>
            {!furniture && <p className={styles.note}>{FURNITURE_NOTE}</p>}
          </Modal.Body>
          <Modal.Footer className={styles.footer}>
            <Button variant="secondary" onPress={onCancel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isDisabled={!chosen}
              onPress={() => chosen && onApply(chosen, furniture)}
            >
              {CONFIRM}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
