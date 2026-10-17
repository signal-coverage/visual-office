import { useEffect, useState } from "react";
import { keyboardInset } from "./viewport";

/**
 * How many pixels of the bottom of the window the virtual keyboard covers, kept
 * up to date while `active`. Zero without a keyboard, and where the browser
 * does not say.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const visible = window.visualViewport;
    if (!active || !visible) return;
    const update = () => setInset(keyboardInset(window.innerHeight, visible));
    update();
    visible.addEventListener("resize", update);
    visible.addEventListener("scroll", update);
    return () => {
      visible.removeEventListener("resize", update);
      visible.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [active]);

  return active ? inset : 0;
}
