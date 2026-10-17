import { reportClientError, setClientReporter } from "./reporter";

type ClientReporter = (
  error: unknown,
  context?: Record<string, unknown>,
) => void;

/** How many failures from before the reporter was downloaded are kept to be sent. */
const MAX_EARLY = 10;

export interface MonitoringDeps {
  target: Pick<EventTarget, "addEventListener">;
  /** Runs `run` once the page has painted and is idle. */
  whenIdle: (run: () => void) => void;
  /** Downloads the reporter: a separate chunk, only ever asked for here. */
  load: () => Promise<{
    createClientReporter: (dsn: string) => ClientReporter | null;
  }>;
}

/**
 * Turns on error monitoring when the site was built with a DSN. Without one
 * this does nothing: no listener, no download, no network call. With one, the
 * reporter is downloaded after the first paint; failures in the meantime are
 * kept (a few) and sent once it is there.
 */
export function startMonitoring(
  dsn: string | undefined,
  deps: MonitoringDeps,
): boolean {
  const address = dsn?.trim();
  if (!address) return false;

  const early: Array<[unknown, Record<string, unknown> | undefined]> = [];
  setClientReporter((error, context) => {
    if (early.length < MAX_EARLY) early.push([error, context]);
  });
  deps.target.addEventListener("error", (event) => {
    const { error, message } = event as Event & {
      error?: unknown;
      message?: string;
    };
    reportClientError(error ?? message, { source: "window.onerror" });
  });
  deps.target.addEventListener("unhandledrejection", (event) => {
    reportClientError((event as Event & { reason?: unknown }).reason, {
      source: "unhandledrejection",
    });
  });

  deps.whenIdle(() => {
    deps
      .load()
      .then(({ createClientReporter }) => {
        const reporter = createClientReporter(address);
        setClientReporter(reporter);
        if (reporter)
          for (const [error, context] of early) reporter(error, context);
        early.length = 0;
      })
      .catch(() => setClientReporter(null));
  });
  return true;
}
