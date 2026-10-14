import { Button, Tooltip } from "@heroui/react";
import type { TipButtonProps } from "./types";

/** A button that says, on hover, what it does or why it cannot be used. */
export function TipButton({ tip, ...button }: TipButtonProps) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button {...button} />
      </Tooltip.Trigger>
      <Tooltip.Content>{tip}</Tooltip.Content>
    </Tooltip>
  );
}
