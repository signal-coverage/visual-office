/**
 * Runs inside the page, before the app does. The development build shows a
 * banner of LocatorJS for a few seconds at the bottom left, and it takes the
 * touches that land there: a thumb on the joystick would be a thumb on the banner.
 */
export function hideDevOverlay() {
  const style = document.createElement("style");
  style.textContent = "#locatorjs-wrapper { display: none !important; }";
  document.addEventListener("DOMContentLoaded", () =>
    document.head.append(style),
  );
}
