import { INKS } from "../../../shared/drawing.ts";
import { BOARD_HINT } from "./consts";
import * as styles from "./styles";
import type { BoardHintProps } from "./types";

export function BoardHint({ ink }: BoardHintProps) {
  if (ink === null) return null;

  return (
    <div className={styles.bar} role="status">
      <div className={styles.pens}>
        {INKS.map((option, index) => (
          <span
            key={option.name}
            title={`${index + 1} · ${option.name}`}
            style={styles.pen(option.color, index === ink)}
          />
        ))}
      </div>
      <div>{BOARD_HINT}</div>
    </div>
  );
}
