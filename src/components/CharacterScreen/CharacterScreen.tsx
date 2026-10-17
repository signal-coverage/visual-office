import {
  Button,
  Description,
  Form,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { randomAppearance } from "../../../shared/appearance.ts";
import { AppearancePicker, RANDOM_LABEL } from "../AppearancePicker";
import { AvatarPreview } from "../AvatarPreview";
import { usePreviewSize } from "../AvatarPreview/usePreviewSize";
import {
  BACK_LABEL,
  NAME_LABEL,
  NAME_LOCKED_HINT,
  NAME_MAX_LENGTH,
  NAME_PLACEHOLDER,
  PREVIEW_FALLBACK_NAME,
  SAVED_NOTE,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { CharacterScreenProps } from "./types";

/**
 * Where the player changes how they look and, when the company allows it, what
 * they are called. Every change is kept as it is made: the screen only has Back.
 */
export function CharacterScreen({
  name,
  appearance,
  fixedName,
  accountMenu,
  touch,
  onNameChange,
  onAppearanceChange,
  onBack,
}: CharacterScreenProps) {
  const size = usePreviewSize();
  const shownName = fixedName ?? name;

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        {accountMenu && <div className={styles.accountMenu}>{accountMenu}</div>}

        <div className={styles.previewColumn}>
          <AvatarPreview
            name={shownName.trim() || PREVIEW_FALLBACK_NAME}
            appearance={appearance}
            size={size}
          />
          <Button
            variant="secondary"
            size="sm"
            onPress={() => onAppearanceChange(randomAppearance())}
          >
            {RANDOM_LABEL}
          </Button>
        </div>

        <div className={styles.fieldsColumn}>
          <div className={styles.actions}>
            <Button variant="secondary" onPress={onBack}>
              {BACK_LABEL}
            </Button>
          </div>
          <header>
            <h1 className={styles.title}>{TITLE}</h1>
            <p className={styles.note}>{SAVED_NOTE}</p>
          </header>

          <Form className={styles.form} onSubmit={(e) => e.preventDefault()}>
            <TextField
              className={styles.nameField}
              value={shownName}
              isReadOnly={fixedName !== undefined}
              autoFocus={fixedName === undefined && !touch}
              onChange={onNameChange}
            >
              <Label>{NAME_LABEL}</Label>
              <Input
                fullWidth
                maxLength={NAME_MAX_LENGTH}
                placeholder={NAME_PLACEHOLDER}
                autoComplete="off"
              />
              {fixedName !== undefined && (
                <Description>{NAME_LOCKED_HINT}</Description>
              )}
            </TextField>
            <AppearancePicker
              value={appearance}
              onChange={onAppearanceChange}
            />
          </Form>
        </div>
      </div>
    </div>
  );
}
