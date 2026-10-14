import {
  Alert,
  Button,
  Description,
  Form,
  Input,
  Kbd,
  Label,
  TextField,
} from "@heroui/react";
import { useState, type FormEvent } from "react";
import { randomAppearance } from "../../../shared/appearance.ts";
import { AppearancePicker, RANDOM_LABEL } from "../AppearancePicker";
import { AvatarPreview } from "../AvatarPreview";
import {
  ACTIVITY_LABEL,
  BUTTON_LABEL,
  CALENDARS_LABEL,
  CONTENT_LABEL,
  actionOf,
  EDIT_FLOOR_LABEL,
  enteringRoom,
  EYEBROW,
  HINT_KEYS,
  INVITE_PEOPLE_LABEL,
  MANAGE_PEOPLE_LABEL,
  NAME_LABEL,
  NAME_LOCKED_HINT,
  NAME_MAX_LENGTH,
  NAME_PLACEHOLDER,
  PREVIEW_FALLBACK_NAME,
  ROOMS_LABEL,
  SETTINGS_LABEL,
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
  onOpenSettings,
  onOpenActivity,
  onOpenCalendars,
  onManageRooms,
  onManageContent,
  roomName,
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

        <div className={styles.previewColumn}>
          <AvatarPreview
            name={name.trim() || PREVIEW_FALLBACK_NAME}
            appearance={appearance}
            size="large"
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
          <header>
            <p className={styles.eyebrow}>{EYEBROW}</p>
            <h1 className={styles.title}>{TITLE}</h1>
            <p className={styles.subtitle}>{SUBTITLE}</p>
            {roomName && (
              <p className={styles.room}>{enteringRoom(roomName)}</p>
            )}
          </header>

          <Form className={styles.form} onSubmit={handleSubmit}>
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
              {fixedName !== undefined && (
                <Description>{NAME_LOCKED_HINT}</Description>
              )}
            </TextField>
            <AppearancePicker value={appearance} onChange={setAppearance} />

            <ul className={styles.controls}>
              {HINT_KEYS.map((keys) => (
                <li key={keys} className={styles.controlRow}>
                  <Kbd>{keys}</Kbd>
                  <span>{actionOf(keys)}</span>
                </li>
              ))}
            </ul>

            <Button
              type="submit"
              fullWidth
              size="lg"
              className={styles.submit}
              isDisabled={busy}
            >
              {BUTTON_LABEL[phase]}
            </Button>
            {(onEditFloor ||
              onManagePeople ||
              onInvitePeople ||
              onOpenSettings ||
              onOpenActivity ||
              onOpenCalendars ||
              onManageRooms ||
              onManageContent) && (
              <div className={styles.admin}>
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
                {onOpenSettings && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={busy}
                    onPress={onOpenSettings}
                  >
                    {SETTINGS_LABEL}
                  </Button>
                )}
                {onOpenActivity && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={busy}
                    onPress={onOpenActivity}
                  >
                    {ACTIVITY_LABEL}
                  </Button>
                )}
                {onOpenCalendars && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={busy}
                    onPress={onOpenCalendars}
                  >
                    {CALENDARS_LABEL}
                  </Button>
                )}
                {onManageRooms && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={busy}
                    onPress={onManageRooms}
                  >
                    {ROOMS_LABEL}
                  </Button>
                )}
                {onManageContent && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={busy}
                    onPress={onManageContent}
                  >
                    {CONTENT_LABEL}
                  </Button>
                )}
              </div>
            )}
          </Form>

          {message && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{message}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
