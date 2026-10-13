import {
  Alert,
  Button,
  Form,
  Input,
  Kbd,
  Label,
  TextField,
} from "@heroui/react";
import { useState, type FormEvent } from "react";
import { randomAppearance } from "../../../shared/appearance.ts";
import { CONTROLS } from "../../App/controls";
import { AppearancePicker, RANDOM_LABEL } from "../AppearancePicker";
import { AvatarPreview } from "../AvatarPreview";
import {
  BUTTON_LABEL,
  EDIT_FLOOR_LABEL,
  INVITE_PEOPLE_LABEL,
  MANAGE_PEOPLE_LABEL,
  NAME_LABEL,
  NAME_MAX_LENGTH,
  NAME_PLACEHOLDER,
  PREVIEW_FALLBACK_NAME,
  SUBTITLE,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { LobbyScreenProps } from "./types";

export function LobbyScreen({
  phase,
  initialName,
  initialAppearance,
  message,
  fixedName,
  accountMenu,
  onEditFloor,
  onManagePeople,
  onInvitePeople,
  onJoin,
}: LobbyScreenProps) {
  const [typedName, setName] = useState(initialName);
  // Somebody who signed in is called what their profile says
  const name = fixedName ?? typedName;
  const [appearance, setAppearance] = useState(initialAppearance);
  const busy = phase === "connecting";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onJoin(name, appearance);
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        {accountMenu && <div className={styles.accountMenu}>{accountMenu}</div>}
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.subtitle}>{SUBTITLE}</p>

        <Form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.columns}>
            <div className={styles.previewColumn}>
              <AvatarPreview
                name={name.trim() || PREVIEW_FALLBACK_NAME}
                appearance={appearance}
              />
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setAppearance(randomAppearance())}
              >
                {RANDOM_LABEL}
              </Button>
            </div>

            <div className={styles.fieldsColumn}>
              <TextField
                className={styles.nameField}
                value={name}
                isReadOnly={fixedName !== undefined}
                autoFocus={fixedName === undefined}
                onChange={setName}
              >
                <Label>{NAME_LABEL}</Label>
                <Input
                  fullWidth
                  maxLength={NAME_MAX_LENGTH}
                  placeholder={NAME_PLACEHOLDER}
                  autoComplete="off"
                />
              </TextField>
              <AppearancePicker value={appearance} onChange={setAppearance} />
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            className={styles.submit}
            isDisabled={busy}
          >
            {BUTTON_LABEL[phase]}
          </Button>
          {onEditFloor && (
            <Button
              variant="secondary"
              size="sm"
              isDisabled={busy}
              onPress={onEditFloor}
            >
              {EDIT_FLOOR_LABEL}
            </Button>
          )}
          {onManagePeople && (
            <Button
              variant="secondary"
              size="sm"
              isDisabled={busy}
              onPress={onManagePeople}
            >
              {MANAGE_PEOPLE_LABEL}
            </Button>
          )}
          {onInvitePeople && (
            <Button
              variant="secondary"
              size="sm"
              isDisabled={busy}
              onPress={onInvitePeople}
            >
              {INVITE_PEOPLE_LABEL}
            </Button>
          )}
        </Form>

        {message && (
          <Alert status="danger" className={styles.message}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <ul className={styles.controls}>
          {CONTROLS.map(([keys, action]) => (
            <li key={keys} className={styles.controlRow}>
              <Kbd className={styles.key}>{keys}</Kbd>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
