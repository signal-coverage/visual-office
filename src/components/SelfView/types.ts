export interface SelfViewProps {
  /** Our own camera feed, or null while the camera is off. */
  element: HTMLVideoElement | null;
  /** On a phone: smaller, and left to the column of badges to place. */
  touch?: boolean;
}
