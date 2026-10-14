import { Button } from "@heroui/react";
import { MAP_UNAVAILABLE_TEXT } from "../../floors/consts";
import { drawPreview } from "../../floors/previewDraw";
import { cardLabel } from "../../floors/rooms";
import { CARD_PADDING, CARD_SIZE, HERE_LABEL } from "./consts";
import * as styles from "./styles";
import type { RoomCardProps } from "./types";

/**
 * One room on the map: its plan in grey, in colour with its name when it is
 * pointed at or focused and the person may enter. A room they may not enter
 * stays grey and says so. It only asks to go: the server decides at the door.
 */
export function RoomCard({ floor, here, preview, onSelect }: RoomCardProps) {
  const { width, height, rects } = drawPreview(
    preview,
    CARD_SIZE,
    CARD_PADDING,
  );
  return (
    <Button
      variant="ghost"
      className={styles.card(here)}
      aria-label={cardLabel(floor, here)}
      onPress={onSelect}
      data-room={floor.id}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        {rects.map((r, index) => (
          <rect
            key={index}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            className={styles.rect(r.kind, floor.canEnter)}
          />
        ))}
      </svg>
      <span className={styles.nameTag} aria-hidden="true">
        {floor.name}
      </span>
      {here && (
        <span className={styles.here} aria-hidden="true">
          {HERE_LABEL}
        </span>
      )}
      {!floor.canEnter && (
        <span className={styles.unavailable} aria-hidden="true">
          {MAP_UNAVAILABLE_TEXT}
        </span>
      )}
    </Button>
  );
}
