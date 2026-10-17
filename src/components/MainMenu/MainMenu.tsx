import { Alert, Button, Kbd, Modal, Spinner } from "@heroui/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { moveFocus } from "../../floors/rooms";
import { AvatarPreview } from "../AvatarPreview";
import { usePreviewSize } from "../AvatarPreview/usePreviewSize";
import {
  actionOf,
  ADMIN_CLOSE,
  ADMIN_TITLE,
  CONNECTING_LABEL,
  enteringRoom,
  EXIT_CONFIRM,
  HINT_KEYS,
  LABELS,
  MENU_LABEL,
  PREVIEW_FALLBACK_NAME,
  TAGLINE,
  TITLE,
  TOUCH_HINTS,
} from "./consts";
import { adminTools, menuItems } from "./helpers";
import * as styles from "./styles";
import type { MainMenuProps, MenuItem } from "./types";

/**
 * The first screen, as in a video game: the title in the middle, the options
 * on the left and the character, turning, on the right. It only asks: the app
 * decides what each option does.
 */
export function MainMenu({
  name,
  appearance,
  floors,
  busy,
  message,
  roomName,
  accountMenu,
  admin,
  signOutOnExit,
  touch,
  onEnter,
  onOtherOffice,
  onCustomize,
  onExit,
}: MainMenuProps) {
  const menu = useRef<HTMLElement>(null);
  const menuId = useId();
  const size = usePreviewSize();
  const [adminOpen, setAdminOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const tools = adminTools(admin);
  const items = menuItems(floors, busy);

  // The first option has the focus from the start; there is no field here to take it from
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const buttons = [
      ...(menu.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      ) ?? []),
    ];
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const next = moveFocus(index, event.key, buttons.length, 1);
    if (
      next === null ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    )
      return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  const press: Record<MenuItem["id"], () => void> = {
    enter: onEnter,
    rooms: onOtherOffice,
    customize: onCustomize,
    exit: () => (signOutOnExit ? setConfirmOpen(true) : onExit()),
  };

  const button = (item: MenuItem, index: number): ReactNode => {
    const entering = busy && item.id === "enter";
    const note =
      item.hint && !busy
        ? item.hint
        : item.id === "enter" && roomName
          ? enteringRoom(roomName)
          : null;
    const noteId = `${menuId}-${item.id}`;
    return (
      <div key={item.id}>
        <Button
          fullWidth
          variant={
            index === 0
              ? "primary"
              : item.id === "exit"
                ? "outline"
                : "secondary"
          }
          className={styles.item}
          isDisabled={item.disabled}
          aria-describedby={note ? noteId : undefined}
          onPress={press[item.id]}
        >
          {entering && <Spinner size="sm" color="current" />}
          {entering ? CONNECTING_LABEL : item.label}
        </Button>
        {note && (
          <p id={noteId} className={styles.itemNote}>
            {note}
          </p>
        )}
      </div>
    );
  };

  return (
    <main className={styles.root} style={styles.backdropStyle}>
      {accountMenu && <div className={styles.accountMenu}>{accountMenu}</div>}

      <header className={styles.header}>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.tagline}>{TAGLINE}</p>
        {message && (
          <Alert status="danger" className={styles.message}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </header>

      <div className={styles.stage}>
        <nav
          ref={menu}
          className={styles.menu}
          aria-label={MENU_LABEL}
          onKeyDown={onKeyDown}
        >
          {items.map(button)}
          {tools.length > 0 && (
            <Button
              fullWidth
              variant="ghost"
              className={styles.item}
              isDisabled={busy}
              onPress={() => setAdminOpen(true)}
            >
              {LABELS.admin}
            </Button>
          )}
        </nav>

        <section className={styles.hero}>
          <AvatarPreview
            name={name.trim() || PREVIEW_FALLBACK_NAME}
            appearance={appearance}
            size={size}
          />
          <p className={styles.playerName}>
            {name.trim() || PREVIEW_FALLBACK_NAME}
          </p>
        </section>
      </div>

      <ul className={styles.hints}>
        {(touch
          ? TOUCH_HINTS
          : HINT_KEYS.map((keys) => [keys, actionOf(keys)] as const)
        ).map(([keys, action]) => (
          <li key={keys} className={styles.hintRow}>
            <Kbd>{keys}</Kbd>
            <span>{action}</span>
          </li>
        ))}
      </ul>

      {adminOpen && (
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(open) => !open && setAdminOpen(false)}
        >
          <Modal.Container>
            <Modal.Dialog className={styles.dialog} aria-label={ADMIN_TITLE}>
              <Modal.Header>
                <Modal.Heading className={styles.dialogTitle}>
                  {ADMIN_TITLE}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col">
                <div className={styles.tools}>
                  {tools.map((tool) => (
                    <Button
                      key={tool.id}
                      fullWidth
                      variant="secondary"
                      onPress={() => {
                        setAdminOpen(false);
                        tool.onPress();
                      }}
                    >
                      {tool.label}
                    </Button>
                  ))}
                </div>
              </Modal.Body>
              <Modal.Footer className={styles.dialogActions}>
                <Button variant="secondary" onPress={() => setAdminOpen(false)}>
                  {ADMIN_CLOSE}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}

      {confirmOpen && (
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(open) => !open && setConfirmOpen(false)}
        >
          <Modal.Container>
            <Modal.Dialog
              className={styles.dialog}
              aria-label={EXIT_CONFIRM.title}
            >
              <Modal.Header>
                <Modal.Heading className={styles.dialogTitle}>
                  {EXIT_CONFIRM.title}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col">
                <p className={styles.dialogText}>{EXIT_CONFIRM.body}</p>
              </Modal.Body>
              <Modal.Footer className={styles.dialogActions}>
                <Button
                  variant="secondary"
                  onPress={() => setConfirmOpen(false)}
                >
                  {EXIT_CONFIRM.cancel}
                </Button>
                <Button variant="danger" onPress={onExit}>
                  {EXIT_CONFIRM.confirm}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </main>
  );
}
