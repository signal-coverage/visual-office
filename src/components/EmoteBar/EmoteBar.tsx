import { Kbd } from "@heroui/react";
import { EMOTE_ICONS, EMOTE_LABELS, EMOTES } from "../../../shared/emotes.ts";
import { TITLE } from "./consts";
import * as styles from "./styles";
import type { EmoteBarProps } from "./types";

/** The gestures and the number of each, shown while the emote key is held. */
export function EmoteBar({ shown }: EmoteBarProps) {
  if (!shown) return null;

  return (
    <div className={styles.bar} role="status" aria-label="Emotes">
      <div className={styles.title}>{TITLE}</div>
      <ul className={styles.list}>
        {EMOTES.map((emote, index) => (
          <li key={emote} className={styles.item}>
            <Kbd className={styles.key}>{index + 1}</Kbd>
            <span className={styles.icon} aria-hidden="true">
              {EMOTE_ICONS[emote]}
            </span>
            <span>{EMOTE_LABELS[emote]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
