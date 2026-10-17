import { Button } from "@heroui/react";
import { CATALOG } from "../../../shared/furniture.ts";
import { ChoiceField, NumberInput } from "../Fields";
import * as styles from "./styles";
import type { InspectorProps } from "./types";

const POSTER_COLOURS = [
  { value: 0, label: "Blue" },
  { value: 1, label: "Orange" },
  { value: 2, label: "Green" },
];

const TURNS = [0, 90, 180, 270].map((deg) => ({
  value: deg,
  label: `${deg}°`,
}));

const round = (n: number) => Math.round(n * 1000) / 1000;

export function Inspector({
  inspected,
  onMove,
  onRotate,
  onVariant,
  onModel,
  onDuplicate,
  onDelete,
  isDisabled,
}: InspectorProps) {
  if (!inspected) {
    return (
      <section className={styles.box}>
        <h2 className={styles.heading}>Selected</h2>
        <p className={styles.hint}>
          Click something on the plan. Drag it to move it, R turns it, Delete
          removes it.
        </p>
      </section>
    );
  }

  const [x, z] =
    inspected.list === "furniture"
      ? [inspected.item.x, inspected.item.z]
      : inspected.prop.at;

  return (
    <section className={styles.box}>
      <h2 className={styles.heading}>Selected</h2>
      <p className={styles.name}>
        {inspected.list === "furniture"
          ? CATALOG[inspected.item.kind].label
          : inspected.prop.model}
      </p>

      <div className={styles.row}>
        <NumberInput
          label="x (m)"
          value={round(x)}
          step={0.05}
          isDisabled={isDisabled}
          onCommit={(v) => onMove(v, z)}
        />
        <NumberInput
          label="z (m)"
          value={round(z)}
          step={0.05}
          isDisabled={isDisabled}
          onCommit={(v) => onMove(x, v)}
        />
      </div>

      {inspected.list === "furniture" && (
        <>
          <div className={styles.row}>
            <Button
              variant="secondary"
              className={styles.button}
              isDisabled={isDisabled}
              onPress={onRotate}
            >
              Turn (R) · {inspected.item.rotation}°
            </Button>
          </div>
          {inspected.item.kind === "poster" && (
            <ChoiceField
              label="Colour"
              value={inspected.item.variant ?? 0}
              options={POSTER_COLOURS}
              isDisabled={isDisabled}
              onChoose={onVariant}
            />
          )}
        </>
      )}

      {inspected.list === "models" && (
        <>
          <ChoiceField
            label="Turn"
            value={inspected.prop.rotationDeg ?? 0}
            options={TURNS}
            isDisabled={isDisabled}
            onChoose={(rotationDeg) => onModel({ rotationDeg })}
          />
          <div className={styles.row}>
            <NumberInput
              label="Blocks width (m)"
              value={inspected.prop.footprint?.[0] ?? 0}
              step={0.05}
              min={0}
              isDisabled={isDisabled}
              onCommit={(v) =>
                onModel({ footprint: [v, inspected.prop.footprint?.[1] ?? v] })
              }
            />
            <NumberInput
              label="Blocks depth (m)"
              value={inspected.prop.footprint?.[1] ?? 0}
              step={0.05}
              min={0}
              isDisabled={isDisabled}
              onCommit={(v) =>
                onModel({ footprint: [inspected.prop.footprint?.[0] ?? v, v] })
              }
            />
          </div>
          <p className={styles.hint}>
            Width and depth of the floor area people cannot walk through. 0
            means they can walk through it.
          </p>
          <NumberInput
            label="Scale"
            value={inspected.prop.scale ?? 1}
            step={0.05}
            min={0.1}
            isDisabled={isDisabled}
            onCommit={(v) => onModel({ scale: v })}
          />
        </>
      )}

      <div className={styles.row}>
        <Button
          variant="secondary"
          className={styles.button}
          isDisabled={isDisabled}
          onPress={onDuplicate}
        >
          Duplicate
        </Button>
        <Button
          variant="danger"
          className={styles.button}
          isDisabled={isDisabled}
          onPress={onDelete}
        >
          Delete
        </Button>
      </div>
    </section>
  );
}
