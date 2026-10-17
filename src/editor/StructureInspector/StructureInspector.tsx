import { Button } from "@heroui/react";
import { useState } from "react";
import { SHELL_LIMITS } from "../../../shared/shell.ts";
import { ChoiceField, NumberInput, TextInput } from "../Fields";
import { geometryOf } from "../shellEdit";
import { describeRef, facingOfYaw, YAW_CHOICES } from "../structureView";
import {
  EMPTY_HINT,
  OPEN_FLOOR,
  TONE_OPTIONS,
  ZONE_DELETE_HINT,
} from "./consts";
import * as styles from "./styles";
import type { StructureInspectorProps } from "./types";

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The name and the id of a zone or an area, each applied when the person leaves the field. */
function Names({
  label,
  id,
  isDisabled,
  onRename,
}: {
  label: string;
  id: string;
  isDisabled?: boolean;
  onRename: StructureInspectorProps["onRename"];
}) {
  const [error, setError] = useState<{ field: string; text: string } | null>(
    null,
  );
  const rename = (field: "label" | "id", value: string) => {
    const text = onRename({ [field]: value });
    setError(text ? { field, text } : null);
  };
  return (
    <>
      <TextInput
        key={`label:${label}`}
        label="Name"
        value={label}
        maxLength={SHELL_LIMITS.labelLength}
        isDisabled={isDisabled}
        error={error?.field === "label" ? error.text : null}
        onCommit={(value) => rename("label", value)}
      />
      <TextInput
        key={`id:${id}`}
        label="Id"
        value={id}
        maxLength={SHELL_LIMITS.idLength}
        isDisabled={isDisabled}
        error={error?.field === "id" ? error.text : null}
        onCommit={(value) => rename("id", value)}
      />
    </>
  );
}

export function StructureInspector({
  shell,
  structure,
  isDisabled,
  onGeometry,
  onMount,
  onRename,
  onTone,
  onYaw,
  onDelete,
}: StructureInspectorProps) {
  const known = structure ? describeRef(shell, structure) : null;
  const geometry = structure ? geometryOf(shell, structure) : null;
  const named =
    structure?.kind === "zone"
      ? shell.zones[structure.index]
      : structure?.kind === "area"
        ? shell.areas[structure.index]
        : undefined;
  const mount =
    structure?.kind === "board"
      ? shell.boards[structure.index]
      : structure?.kind === "screen"
        ? shell.screens[structure.index]
        : undefined;
  if (!structure || !known) {
    return (
      <section className={styles.box}>
        <h2 className={styles.heading}>Selected</h2>
        <p className={styles.hint}>{EMPTY_HINT}</p>
      </section>
    );
  }

  const zoneOptions = shell.zones.map((zone) => ({
    value: zone.id,
    label: zone.label,
  }));

  return (
    <section
      className={styles.box}
      key={`${structure.kind}:${structure.index}`}
    >
      <h2 className={styles.heading}>Selected</h2>
      <p className={styles.name}>{known}</p>

      {named && (
        <Names
          label={named.label}
          id={named.id}
          isDisabled={isDisabled}
          onRename={onRename}
        />
      )}

      {geometry && (
        <>
          <div className={styles.row}>
            <NumberInput
              label="x (m)"
              value={round(geometry.x)}
              step={0.05}
              isDisabled={isDisabled}
              onCommit={(x) => onGeometry({ x })}
            />
            <NumberInput
              label="z (m)"
              value={round(geometry.z)}
              step={0.05}
              isDisabled={isDisabled}
              onCommit={(z) => onGeometry({ z })}
            />
          </div>
          <div className={styles.row}>
            <NumberInput
              label="Width (m)"
              value={round(geometry.width)}
              step={0.05}
              min={0}
              isDisabled={isDisabled}
              onCommit={(width) => onGeometry({ width })}
            />
            <NumberInput
              label="Depth (m)"
              value={round(geometry.depth)}
              step={0.05}
              min={0}
              isDisabled={isDisabled}
              onCommit={(depth) => onGeometry({ depth })}
            />
          </div>
        </>
      )}

      {structure.kind === "floor" && shell.floors[structure.index] && (
        <ChoiceField
          label="Colour"
          value={shell.floors[structure.index].tone}
          options={TONE_OPTIONS}
          isDisabled={isDisabled}
          onChoose={onTone}
        />
      )}

      {structure.kind === "spawn" && (
        <ChoiceField
          label="People look"
          value={facingOfYaw(shell.spawn.yaw)}
          options={YAW_CHOICES.map((choice) => ({
            value: choice.label,
            label: choice.label,
          }))}
          isDisabled={isDisabled}
          onChoose={(label) => {
            const chosen = YAW_CHOICES.find((choice) => choice.label === label);
            if (chosen) onYaw(chosen.yaw);
          }}
        />
      )}

      {mount && (
        <>
          <p className={styles.hint}>
            Hangs on a wall facing {mount.facing}. Drag it to another wall.
          </p>
          <div className={styles.row}>
            <NumberInput
              label="Along the wall (m)"
              value={round(mount.along)}
              step={0.05}
              isDisabled={isDisabled}
              onCommit={(along) => onMount({ along })}
            />
            <NumberInput
              label="Height above floor (m)"
              value={round(mount.y)}
              step={0.05}
              min={0}
              isDisabled={isDisabled}
              onCommit={(y) => onMount({ y })}
            />
          </div>
          <div className={styles.row}>
            <NumberInput
              label="Width (m)"
              value={round(mount.width)}
              step={0.05}
              min={0}
              isDisabled={isDisabled}
              onCommit={(width) => onMount({ width })}
            />
            {"height" in mount && (
              <NumberInput
                label="Height (m)"
                value={round(mount.height)}
                step={0.05}
                min={0}
                isDisabled={isDisabled}
                onCommit={(height) => onMount({ height })}
              />
            )}
          </div>
          <ChoiceField
            label="Belongs to"
            value={mount.zone ?? OPEN_FLOOR}
            options={[
              ...(structure.kind === "board"
                ? [{ value: OPEN_FLOOR, label: "The open floor" }]
                : []),
              ...zoneOptions,
            ]}
            isDisabled={isDisabled}
            onChoose={(zone) =>
              onMount({ zone: zone === OPEN_FLOOR ? null : zone })
            }
          />
        </>
      )}

      {structure.kind === "zone" && (
        <p className={styles.hint}>{ZONE_DELETE_HINT}</p>
      )}
      {structure.kind !== "spawn" && (
        <div className={styles.row}>
          <Button
            variant="danger"
            className={styles.button}
            isDisabled={isDisabled}
            onPress={onDelete}
          >
            Delete
          </Button>
        </div>
      )}
    </section>
  );
}
