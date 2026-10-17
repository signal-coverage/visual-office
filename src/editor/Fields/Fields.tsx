import {
  FieldError,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import * as styles from "./styles";
import type {
  ChoiceFieldProps,
  NumberFieldProps,
  TextFieldProps,
} from "./types";

/** A number that is applied when the person leaves the field or presses Enter, not on each keystroke. */
export function NumberInput({
  label,
  value,
  step,
  min,
  max,
  isDisabled,
  onCommit,
}: NumberFieldProps) {
  return (
    <NumberField
      className={styles.field}
      value={value}
      step={step}
      minValue={min}
      maxValue={max}
      isDisabled={isDisabled}
      onChange={(next) => {
        if (next !== undefined && Number.isFinite(next) && next !== value)
          onCommit(next);
      }}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.Input />
      </NumberField.Group>
    </NumberField>
  );
}

export function ChoiceField<T extends string | number>({
  label,
  value,
  options,
  isDisabled,
  onChoose,
}: ChoiceFieldProps<T>) {
  return (
    <Select
      className={styles.field}
      value={value}
      isDisabled={isDisabled}
      onChange={(next) => {
        if (next === null || Array.isArray(next)) return;
        const chosen = options.find(
          (option) => String(option.value) === String(next),
        );
        if (chosen) onChoose(chosen.value);
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * A text that is applied when the person leaves the field or presses Enter.
 * Give it a `key` that changes with what it shows, so it starts again from the
 * new text; while a text is refused (`error`) it keeps what was typed.
 */
export function TextInput({
  label,
  value,
  maxLength,
  error,
  isDisabled,
  onCommit,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <TextField
      className={styles.field}
      value={draft}
      isInvalid={!!error}
      isDisabled={isDisabled}
      onChange={setDraft}
    >
      <Label>{label}</Label>
      <Input
        fullWidth
        maxLength={maxLength}
        autoComplete="off"
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
