import { redactText } from "../shared/redact.ts";

export interface ShutdownStep {
  name: string;
  run: () => Promise<unknown>;
}

export interface ShutdownOptions {
  /** In order: first tell the rooms and stop accepting people, then close the database. */
  steps: ShutdownStep[];
  /** The whole shutdown gets this long, then the process exits anyway. */
  timeoutMs: number;
  exit: (code: number) => void;
  log: (line: string) => void;
}

/**
 * Winds the server down once, whatever the number of signals: runs the steps in
 * order (one failing does not stop the next), and exits within `timeoutMs` even
 * if a step never finishes. Exit code 0 only when everything went well.
 */
export function createShutdown(options: ShutdownOptions) {
  let running: Promise<void> | null = null;

  async function steps(): Promise<boolean> {
    let clean = true;
    for (const step of options.steps) {
      try {
        await step.run();
        options.log(`Shutdown: ${step.name} done`);
      } catch (error) {
        clean = false;
        const reason = error instanceof Error ? error.message : String(error);
        options.log(`Shutdown: ${step.name} failed: ${redactText(reason)}`);
      }
    }
    return clean;
  }

  async function wind(reason: string, requested: number) {
    options.log(`Shutting down (${reason})`);
    let timer: NodeJS.Timeout | undefined;
    const outcome = await Promise.race([
      steps(),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), options.timeoutMs);
      }),
    ]);
    clearTimeout(timer);
    if (outcome === "timeout")
      options.log(
        `Shutdown: out of time after ${options.timeoutMs} ms, exiting`,
      );
    options.exit(outcome === true ? requested : 1);
  }

  return {
    isShuttingDown: () => running !== null,
    run(reason: string, exitCode = 0): Promise<void> {
      running ??= wind(reason, exitCode);
      return running;
    },
  };
}
