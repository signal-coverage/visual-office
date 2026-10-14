import {
  Badge,
  Button,
  Input,
  Label,
  ListBox,
  Select,
  Tabs,
} from "@heroui/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  CHAT_SCOPE_LABELS,
  CHAT_SCOPES,
  MAX_CHAT_LENGTH,
  type ChatScope,
} from "../../../shared/chat.ts";
import { cn } from "../../lib/cn";
import { StatusDot } from "../StatusDot";
import {
  CANCEL_KEY,
  MAX_VISIBLE_MESSAGES,
  NEARBY_TAG,
  NOBODY,
  OPEN_KEY,
  OPEN_LABEL,
  PEOPLE_LABEL,
  PICK_SOMEBODY,
  PLACEHOLDERS,
  SCOPE_LABEL,
  YOU,
} from "./consts";
import * as styles from "./styles";
import type { ChatPanelProps } from "./types";

const isScope = (key: unknown): key is ChatScope =>
  typeof key === "string" && (CHAT_SCOPES as readonly string[]).includes(key);

export function ChatPanel({
  messages,
  people,
  unread,
  onSend,
  onOpen,
  onClose,
  onOpenChange,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState<ChatScope>("everyone");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Somebody who left cannot be written to any more
  const target = people.some((p) => p.id === pickedId) ? pickedId : null;
  const targetName = people.find((p) => p.id === target)?.name;
  const placeholder =
    scope === "dm" && targetName
      ? `Message ${targetName} and press Enter`
      : PLACEHOLDERS[scope];

  const open = () => {
    setIsOpen(true);
    onOpen();
    onOpenChange(true);
  };

  useEffect(() => {
    if (isOpen) return;
    const openOnKey = (e: globalThis.KeyboardEvent) => {
      if (e.code !== OPEN_KEY) return;
      e.preventDefault();
      setIsOpen(true);
      onOpen();
      onOpenChange(true);
    };
    document.addEventListener("keydown", openOnKey);
    return () => document.removeEventListener("keydown", openOnKey);
  }, [isOpen, onOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setDraft("");
    setIsOpen(false);
    onOpenChange(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Stop here: otherwise this same event reaches the document listener that
    // re-registers once the panel closes, and the chat would reopen itself.
    if (e.code === CANCEL_KEY) {
      e.stopPropagation();
      close();
    } else if (e.code === OPEN_KEY) {
      e.stopPropagation();
      const text = draft.trim();
      // A direct message needs somebody to go to: keep what was typed until there is
      if (text && scope === "dm" && !target) return;
      if (text) onSend(text, scope, scope === "dm" ? target! : undefined);
      close();
      onClose();
    }
  };

  return (
    <div className={styles.container} data-chat>
      <ul className={styles.list}>
        {messages.slice(-MAX_VISIBLE_MESSAGES).map((m) => (
          <li
            key={`${m.id}-${m.at}`}
            className={cn(styles.message, m.scope === "dm" && styles.direct)}
          >
            <strong
              className={styles.author}
              style={styles.authorColor(m.color)}
            >
              {m.scope !== "dm"
                ? m.name
                : m.mine
                  ? `${YOU} → ${m.toName ?? ""}`
                  : `${m.name} → ${YOU}`}
            </strong>
            {m.scope === "dm" && (
              <span className={styles.tag}>{CHAT_SCOPE_LABELS.dm}</span>
            )}
            {m.scope === "nearby" && (
              <span className={styles.tag}>{NEARBY_TAG}</span>
            )}
            {m.text}
          </li>
        ))}
      </ul>
      {isOpen ? (
        <div className={styles.form}>
          <Tabs
            selectedKey={scope}
            onSelectionChange={(key) => {
              if (isScope(key)) setScope(key);
              inputRef.current?.focus();
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label={SCOPE_LABEL}>
                {CHAT_SCOPES.map((option) => (
                  <Tabs.Tab key={option} id={option}>
                    {CHAT_SCOPE_LABELS[option]}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          {scope === "dm" && (
            <Select
              className={styles.field}
              aria-label={PEOPLE_LABEL}
              placeholder={people.length === 0 ? NOBODY : PICK_SOMEBODY}
              isDisabled={people.length === 0}
              value={target}
              onChange={(next) => {
                if (typeof next === "string") setPickedId(next);
                inputRef.current?.focus();
              }}
            >
              <Label className="sr-only">{PEOPLE_LABEL}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {people.map((person) => (
                    <ListBox.Item
                      key={person.id}
                      id={person.id}
                      textValue={person.name}
                    >
                      <span className={styles.person}>
                        <StatusDot status={person.status} />
                        {person.name}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
          <Input
            ref={inputRef}
            aria-label={placeholder}
            className={styles.input}
            value={draft}
            maxLength={MAX_CHAT_LENGTH}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      ) : (
        <Badge.Anchor className={styles.anchor}>
          <Button variant="ghost" className={styles.openButton} onPress={open}>
            {OPEN_LABEL}
          </Button>
          {unread > 0 && (
            <Badge color="danger" size="sm">
              <Badge.Label>{unread > 9 ? "9+" : unread}</Badge.Label>
            </Badge>
          )}
        </Badge.Anchor>
      )}
    </div>
  );
}
