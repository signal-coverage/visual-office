import { Button, ToggleButton } from "@heroui/react";
import { useRef } from "react";
import { CATALOG, FURNITURE_KINDS } from "../../../shared/furniture.ts";
import * as styles from "./styles";
import type { PaletteProps } from "./types";

export function Palette({
  models,
  placing,
  onPlace,
  onUpload,
  isDisabled,
}: PaletteProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <aside className={styles.palette}>
      <section>
        <h2 className={styles.heading}>Furniture</h2>
        <div className={styles.list}>
          {FURNITURE_KINDS.map((kind) => {
            const active =
              placing?.kind === "furniture" && placing.furniture === kind;
            return (
              <ToggleButton
                key={kind}
                className={styles.item}
                isDisabled={isDisabled}
                isSelected={active}
                onChange={() =>
                  onPlace(
                    active ? null : { kind: "furniture", furniture: kind },
                  )
                }
              >
                {CATALOG[kind].label}
              </ToggleButton>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className={styles.heading}>Your models</h2>
        <div className={styles.list}>
          {models.map((model) => {
            const active = placing?.kind === "model" && placing.model === model;
            return (
              <ToggleButton
                key={model}
                className={styles.item}
                isDisabled={isDisabled}
                isSelected={active}
                onChange={() =>
                  onPlace(active ? null : { kind: "model", model })
                }
              >
                {model.replace(/\.glb$/, "")}
              </ToggleButton>
            );
          })}
          {onUpload && (
            <>
              <Button
                variant="outline"
                className={styles.upload}
                isDisabled={isDisabled}
                onPress={() => fileInput.current?.click()}
              >
                Upload a model…
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".glb,model/gltf-binary"
                hidden
                aria-label="Upload a .glb model"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  // So that picking the same file again still counts
                  e.currentTarget.value = "";
                  if (file) onUpload(file);
                }}
              />
            </>
          )}
          {models.length === 0 && (
            <p className={styles.hint}>
              No .glb files in public/models yet. See docs/MODELING.md.
            </p>
          )}
        </div>
      </section>

      <p className={styles.hint}>
        Pick something, then click on the plan to put it down. Esc to stop.
      </p>
    </aside>
  );
}
