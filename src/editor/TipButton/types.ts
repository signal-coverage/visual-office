import type { Button } from "@heroui/react";
import type { ComponentProps } from "react";

export type TipButtonProps = ComponentProps<typeof Button> & {
  /** What the button does, shown when the pointer rests on it. */
  tip: string;
};
