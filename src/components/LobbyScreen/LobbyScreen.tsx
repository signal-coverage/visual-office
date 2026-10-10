import { useState, type FormEvent } from "react";
import {
  BUTTON_LABEL,
  CONTROLS,
  NAME_LABEL,
  NAME_MAX_LENGTH,
  NAME_PLACEHOLDER,
  SUBTITLE,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { LobbyScreenProps } from "./types";

export function LobbyScreen({
  phase,
  initialName,
  message,
  onJoin,
}: LobbyScreenProps) {
  const [name, setName] = useState(initialName);
  const busy = phase === "connecting";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onJoin(name);
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <h1 style={styles.title}>{TITLE}</h1>
        <p style={styles.subtitle}>{SUBTITLE}</p>

        <form style={styles.form} onSubmit={handleSubmit}>
          <label style={styles.label} htmlFor="player-name">
            {NAME_LABEL}
          </label>
          <input
            id="player-name"
            style={styles.input}
            value={name}
            maxLength={NAME_MAX_LENGTH}
            placeholder={NAME_PLACEHOLDER}
            autoFocus
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" style={styles.button(busy)} disabled={busy}>
            {BUTTON_LABEL[phase]}
          </button>
        </form>

        {message && (
          <p style={styles.message} role="alert">
            {message}
          </p>
        )}

        <ul style={styles.controls}>
          {CONTROLS.map(([keys, action]) => (
            <li key={keys} style={styles.controlRow}>
              <span style={styles.key}>{keys}</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
