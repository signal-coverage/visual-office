export interface ToastProps {
  /** What to say, or null for nothing. The owner decides when it goes away. */
  text: string | null;
  /** Where it goes: an alert (a direct message, a knock) sits below the usual notices so neither hides the other. */
  slot?: "notice" | "alert";
}
