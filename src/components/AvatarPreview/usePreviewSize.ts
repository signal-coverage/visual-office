import { useEffect, useState } from "react";
import { previewSizeFor } from "./helpers";

const read = () =>
  previewSizeFor({ width: window.innerWidth, height: window.innerHeight });

/** The size of preview that fits the window now, following it as it is resized or turned. */
export function usePreviewSize() {
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}
