import type { TouchInput } from "../../touch/touchInput";

export interface TouchPadProps {
  /** Where the fingers go: the game reads it every frame. */
  input: TouchInput;
}
