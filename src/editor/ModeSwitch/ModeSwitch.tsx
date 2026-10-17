import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { MODES } from "./consts";
import * as styles from "./styles";
import type { ModeSwitchProps } from "./types";

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <ToggleButtonGroup
      aria-label="What to edit"
      size="sm"
      disallowEmptySelection
      className={styles.group}
      selectedKeys={[mode]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        const chosen = MODES.find((candidate) => candidate.id === next);
        if (chosen) onChange(chosen.id);
      }}
    >
      {MODES.map((candidate) => (
        <ToggleButton key={candidate.id} id={candidate.id}>
          {candidate.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
