import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Point } from "../../touch/touchInput";
import * as styles from "./styles";
import type { TouchPadProps } from "./types";

const noMenu = (event: { preventDefault: () => void }) =>
  event.preventDefault();

/**
 * The two thumbs: a joystick at the bottom left, and the whole scene to look
 * around by dragging and to use things by tapping. Each finger is followed by
 * its pointer id and captured, so a drag that leaves the joystick or the screen
 * keeps being the same drag, and the two thumbs never mix.
 */
export function TouchPad({ input }: TouchPadProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Point | null>(null);

  // A call, a switch of app or a hidden page takes the touches away without saying so
  useEffect(() => {
    const letGo = () => {
      input.cancelAll();
      setThumb(null);
    };
    document.addEventListener("visibilitychange", letGo);
    window.addEventListener("blur", letGo);
    return () => {
      document.removeEventListener("visibilitychange", letGo);
      window.removeEventListener("blur", letGo);
    };
  }, [input]);

  // Safari ignores the viewport's ban on pinching: its own gesture events are stopped here
  useEffect(() => {
    document.addEventListener("gesturestart", noMenu);
    return () => document.removeEventListener("gesturestart", noMenu);
  }, []);

  const onLookDown = (event: PointerEvent<HTMLDivElement>) => {
    const { pointerId, clientX, clientY, timeStamp } = event;
    if (!input.begin("look", pointerId, clientX, clientY, timeStamp)) return;
    event.currentTarget.setPointerCapture(pointerId);
  };
  const onLookMove = (event: PointerEvent<HTMLDivElement>) =>
    input.move(event.pointerId, event.clientX, event.clientY);
  const onLookUp = (event: PointerEvent<HTMLDivElement>) =>
    input.end(event.pointerId, event.clientX, event.clientY, event.timeStamp);
  const onLookCancel = (event: PointerEvent<HTMLDivElement>) =>
    input.cancel(event.pointerId);

  const onStickDown = (event: PointerEvent<HTMLDivElement>) => {
    const zone = zoneRef.current;
    if (!zone) return;
    const { left, top, width, height } = zone.getBoundingClientRect();
    const centre = { x: left + width / 2, y: top + height / 2 };
    const { pointerId, clientX, clientY, timeStamp } = event;
    if (!input.begin("stick", pointerId, clientX, clientY, timeStamp, centre))
      return;
    event.currentTarget.setPointerCapture(pointerId);
    setThumb(input.stickOffset());
  };
  const onStickMove = (event: PointerEvent<HTMLDivElement>) => {
    input.move(event.pointerId, event.clientX, event.clientY);
    setThumb(input.stickOffset());
  };
  const onStickUp = (event: PointerEvent<HTMLDivElement>) => {
    input.end(event.pointerId, event.clientX, event.clientY, event.timeStamp);
    setThumb(input.stickOffset());
  };
  const onStickCancel = (event: PointerEvent<HTMLDivElement>) => {
    input.cancel(event.pointerId);
    setThumb(input.stickOffset());
  };

  return (
    <>
      <div
        className={styles.surface}
        data-testid="touch-look"
        aria-hidden="true"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookCancel}
        onContextMenu={noMenu}
      />
      <div
        ref={zoneRef}
        className={styles.stickZone}
        data-testid="touch-stick"
        aria-hidden="true"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickCancel}
        onContextMenu={noMenu}
      >
        <div className={styles.stickBase}>
          <div
            className={styles.stickThumb}
            style={styles.thumbAt(thumb?.x ?? 0, thumb?.y ?? 0)}
          />
        </div>
      </div>
    </>
  );
}
