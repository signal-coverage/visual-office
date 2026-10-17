import { startMonitoring } from "./start";

/** After the first paint and the idle moment that follows: monitoring must never compete with the first frame. */
function whenIdle(run: () => void) {
  const later = () =>
    "requestIdleCallback" in window
      ? window.requestIdleCallback(run, { timeout: 5000 })
      : setTimeout(run, 2000);
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
}

/** Starts error monitoring if the site was built with VITE_SENTRY_DSN; otherwise it does nothing and loads nothing. */
export function startErrorMonitoring(): void {
  startMonitoring(import.meta.env.VITE_SENTRY_DSN, {
    target: window,
    whenIdle,
    load: () => import("./sentryClient"),
  });
}
