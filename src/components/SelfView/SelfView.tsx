import { useEffect, useRef } from "react";
import * as styles from "./styles";
import type { SelfViewProps } from "./types";

/** A small mirrored preview of our own camera, so we know what others see. */
export function SelfView({ element, touch = false }: SelfViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !element) return;
    Object.assign(element.style, styles.video);
    frame.appendChild(element);
    return () => {
      element.remove();
    };
  }, [element]);

  if (!element) return null;
  return (
    <div ref={frameRef} style={touch ? styles.touchFrame : styles.frame} />
  );
}
