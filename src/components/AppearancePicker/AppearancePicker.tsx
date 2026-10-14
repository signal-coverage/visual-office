import {
  ColorSwatchPicker,
  Fieldset,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { ROWS } from "./consts";
import { hex, indexOfColor } from "./helpers";
import * as styles from "./styles";
import type { AppearancePickerProps } from "./types";

export function AppearancePicker({ value, onChange }: AppearancePickerProps) {
  return (
    <div className={styles.picker}>
      {ROWS.map((row) => (
        <Fieldset key={row.field} className={styles.row}>
          <Fieldset.Legend className={styles.rowLabel}>
            {row.label}
          </Fieldset.Legend>
          {row.kind === "colors" ? (
            <ColorSwatchPicker
              aria-label={row.label}
              size="sm"
              value={hex(row.colors[value[row.field]])}
              onChange={(color) => {
                const index = indexOfColor(row.colors, color.toString("hex"));
                if (index >= 0) onChange({ ...value, [row.field]: index });
              }}
            >
              {row.colors.map((color, index) => (
                <ColorSwatchPicker.Item
                  key={color}
                  color={hex(color)}
                  aria-label={`${row.label} ${index + 1}`}
                >
                  <ColorSwatchPicker.Swatch />
                  <ColorSwatchPicker.Indicator />
                </ColorSwatchPicker.Item>
              ))}
            </ColorSwatchPicker>
          ) : (
            <ToggleButtonGroup
              aria-label={row.label}
              size="sm"
              isDetached
              disallowEmptySelection
              className={styles.options}
              selectedKeys={[value[row.field]]}
              onSelectionChange={(keys) => {
                const [index] = keys;
                if (typeof index === "number") {
                  onChange({ ...value, [row.field]: index });
                }
              }}
            >
              {row.names.map((name, index) => (
                <ToggleButton key={name} id={index}>
                  {name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Fieldset>
      ))}
    </div>
  );
}
