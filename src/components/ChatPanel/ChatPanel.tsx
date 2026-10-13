import { Input } from "@heroui/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MAX_CHAT_LENGTH } from "../../../shared/chat.ts";
import {
  CANCEL_KEY,
  CLOSED_HINT,
  INPUT_PLACEHOLDER,
  MAX_VISIBLE_MESSAGES,
  OPEN_KEY,
} from "./consts";
import * as styles from "./styles";
import type { ChatPanelProps } from "./types";

export function ChatPanel({
  messages,
  onSend,
  onOpen,
  onClose,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) return;
    const openOnKey = (e: globalThis.KeyboardEvent) => {
      if (e.code !== OPEN_KEY) return;
      e.preventDefault();
      setIsOpen(true);
      onOpen();
    };
    document.addEventListener("keydown", openOnKey);
    return () => document.removeEventListener("keydown", openOnKey);
  }, [isOpen, onOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setDraft("");
    setIsOpen(false);
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
      if (text) onSend(text);
      close();
      onClose();
    }
  };

  return (
    <div className={styles.container}>
      <ul className={styles.list}>
        {messages.slice(-MAX_VISIBLE_MESSAGES).map((m) => (
          <li key={`${m.id}-${m.at}`} className={styles.message}>
            <strong
              className={styles.author}
              style={styles.authorColor(m.color)}
            >
              {m.name}
            </strong>
            {m.text}
          </li>
        ))}
      </ul>
      {isOpen ? (
        <Input
          ref={inputRef}
          aria-label={INPUT_PLACEHOLDER}
          className={styles.input}
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={INPUT_PLACEHOLDER}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className={styles.hint}>{CLOSED_HINT}</div>
      )}
    </div>
  );
}
