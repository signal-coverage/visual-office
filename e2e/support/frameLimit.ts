/**
 * Runs inside the page, before the game does. The browser draws 3D in software,
 * and several players at once would starve each other: this lets a page's
 * animation frames through only every so often, as a slow computer would.
 */
export function installFrameLimit() {
  const GAP_MS = 66;
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const current = new Map<number, number>();
  let sequence = 0;
  let lastFrame = -Infinity;

  const due = (time: number) => {
    if (time === lastFrame) return true;
    if (time - lastFrame < GAP_MS) return false;
    lastFrame = time;
    return true;
  };

  window.requestAnimationFrame = (callback) => {
    const id = ++sequence;
    const step: FrameRequestCallback = (time) => {
      if (!due(time)) {
        current.set(id, request(step));
        return;
      }
      current.delete(id);
      callback(time);
    };
    current.set(id, request(step));
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const real = current.get(id);
    if (real === undefined) return;
    current.delete(id);
    cancel(real);
  };
}
