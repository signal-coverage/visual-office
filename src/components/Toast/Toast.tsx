import * as styles from "./styles";
import type { ToastProps } from "./types";

export function Toast({ text, slot = "notice", touch = false }: ToastProps) {
  if (!text) return null;

  return (
    <div
      className={
        slot === "alert"
          ? touch
            ? styles.touchAlert
            : styles.alert
          : touch
            ? styles.touchToast
            : styles.toast
      }
      role="status"
    >
      {text}
    </div>
  );
}
