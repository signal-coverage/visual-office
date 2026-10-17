import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { SHELL_LIMITS } from "../../../shared/shell.ts";
import { NumberInput } from "../Fields";
import { TONES, TOOLS } from "./consts";
import * as styles from "./styles";
import type { StructurePaletteProps } from "./types";

export function StructurePalette({
  tool,
  onTool,
  tone,
  onTone,
  width,
  depth,
  onSize,
  warning,
  onApplyTemplate,
  isDisabled,
}: StructurePaletteProps) {
  const active = TOOLS.find((candidate) => candidate.id === tool);
  return (
    <aside className={styles.palette} aria-label="Structure tools">
      <section>
        <h2 className={styles.heading}>Structure</h2>
        <div className={styles.list}>
          {TOOLS.map((candidate) => (
            <ToggleButton
              key={candidate.id}
              className={styles.item}
              isDisabled={isDisabled}
              isSelected={tool === candidate.id}
              onChange={() => onTool(candidate.id)}
            >
              {candidate.label}
            </ToggleButton>
          ))}
        </div>
        {tool === "floor" && (
          <ToggleButtonGroup
            aria-label="Floor colour"
            size="sm"
            isDetached
            disallowEmptySelection
            className={styles.tones}
            selectedKeys={[tone]}
            onSelectionChange={(keys) => {
              const [next] = keys;
              const chosen = TONES.find((candidate) => candidate.id === next);
              if (chosen) onTone(chosen.id);
            }}
          >
            {TONES.map((candidate) => (
              <ToggleButton key={candidate.id} id={candidate.id}>
                {candidate.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </section>

      {active && <p className={styles.hint}>{active.hint}</p>}

      <section>
        <h2 className={styles.heading}>Floor size</h2>
        <div className={styles.size}>
          <NumberInput
            label="Width (m)"
            value={width}
            step={1}
            min={SHELL_LIMITS.minWidth}
            max={SHELL_LIMITS.maxWidth}
            isDisabled={isDisabled}
            onCommit={(next) => onSize(next, depth)}
          />
          <NumberInput
            label="Depth (m)"
            value={depth}
            step={1}
            min={SHELL_LIMITS.minDepth}
            max={SHELL_LIMITS.maxDepth}
            isDisabled={isDisabled}
            onCommit={(next) => onSize(width, next)}
          />
        </div>
        <p className={styles.hint}>
          {SHELL_LIMITS.minWidth} to {SHELL_LIMITS.maxWidth} m wide,{" "}
          {SHELL_LIMITS.minDepth} to {SHELL_LIMITS.maxDepth} m deep. The height
          is fixed at 3.2 m.
        </p>
        {warning && (
          <p className={styles.warning} role="status">
            {warning}
          </p>
        )}
      </section>

      <section>
        <h2 className={styles.heading}>Template</h2>
        <Button
          variant="outline"
          className={styles.action}
          isDisabled={isDisabled}
          onPress={onApplyTemplate}
        >
          Apply template…
        </Button>
      </section>
    </aside>
  );
}
