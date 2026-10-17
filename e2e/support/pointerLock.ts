declare global {
  interface Window {
    /** Set by the fake below: while true, the browser refuses to capture the mouse, as it does right after Esc. */
    __refusePointerLock?: boolean;
  }
}

/**
 * Runs inside the page, before the game does. Headless Chromium has no
 * pointer lock, so this stands in for it: the same property, the same two
 * calls and the same event, with nothing to do with a real mouse.
 */
export function installFakePointerLock() {
  let locked: Element | null = null;

  Object.defineProperty(Document.prototype, "pointerLockElement", {
    configurable: true,
    get: () => locked,
  });
  const grant = (element: Element) =>
    setTimeout(() => {
      if (window.__refusePointerLock) return;
      locked = element;
      document.dispatchEvent(new Event("pointerlockchange"));
    }, 100);
  Element.prototype.requestPointerLock = function (this: Element) {
    // Like a browser, the answer comes a moment after the request, and asking again for what is already captured is announced again
    grant(this);
    return Promise.resolve();
  } as typeof Element.prototype.requestPointerLock;
  Document.prototype.exitPointerLock = function () {
    if (!locked) return;
    locked = null;
    setTimeout(() => document.dispatchEvent(new Event("pointerlockchange")), 0);
  };
}
