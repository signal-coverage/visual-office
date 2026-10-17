import { redactText } from "../shared/redact.ts";

const MAX_STACK_LENGTH = 4000;

/** One line of JSON describing a failure, safe to print: no passwords, tokens or emails. */
export function errorLogLine(event: string, error: unknown): string {
  const known = error instanceof Error;
  return JSON.stringify({
    level: "error",
    event,
    time: new Date().toISOString(),
    name: known ? error.name : "NonError",
    message: redactText(
      known
        ? error.message
        : typeof error === "string"
          ? error
          : "(not an Error)",
    ),
    ...(known && error.stack
      ? { stack: redactText(error.stack).slice(0, MAX_STACK_LENGTH) }
      : {}),
  });
}

export interface ProcessErrorDeps {
  proc: { on(event: string, listener: (value: unknown) => void): unknown };
  log: (line: string) => void;
  report: (error: unknown, context?: Record<string, unknown>) => void;
  /** Winds the server down; called with the code to exit with. */
  shutdown: (reason: string, exitCode: number) => void;
}

/**
 * Nothing fails silently: an exception nobody caught is logged, reported and
 * ends the process cleanly (the host restarts it); a promise nobody handled is
 * logged and reported and the server keeps running.
 */
export function installProcessErrorHandlers(deps: ProcessErrorDeps): void {
  const note = (event: string, error: unknown) => {
    try {
      deps.log(errorLogLine(event, error));
      deps.report(error, { event });
    } catch {
      // Logging and reporting are best effort
    }
  };
  deps.proc.on("uncaughtException", (error: unknown) => {
    note("uncaughtException", error);
    deps.shutdown("uncaughtException", 1);
  });
  deps.proc.on("unhandledRejection", (reason: unknown) => {
    note("unhandledRejection", reason);
  });
}
