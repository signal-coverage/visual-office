import { errorLogLine } from "./processErrors.ts";

interface Reply {
  status: number;
  body: unknown;
}

interface JsonResponse {
  headersSent: boolean;
  status: (code: number) => JsonResponse;
  json: (body: unknown) => unknown;
}

type Report = (error: unknown, context?: Record<string, unknown>) => void;

/** Sends what a handler answered (not found when it did not know the path). An answer of 500 or more is reported, with the area and the status only. */
export function sendReply(
  res: JsonResponse,
  reply: Reply | null,
  route: string,
  report: Report,
): void {
  const status = reply?.status ?? 404;
  if (status >= 500)
    report(new Error(`HTTP ${status} on ${route}`), { route, status });
  res.status(status).json(reply?.body ?? { error: "Not found." });
}

/**
 * Runs the work of a request so that a failure nobody foresaw is logged,
 * reported and answered with a 500, instead of leaving the caller waiting for
 * an answer that never comes.
 */
export async function runGuarded(
  res: JsonResponse,
  route: string,
  work: () => Promise<void>,
  hooks: { log: (line: string) => void; report: Report },
): Promise<void> {
  try {
    await work();
  } catch (error) {
    hooks.log(errorLogLine("http_error", error));
    hooks.report(error, { route, status: 500 });
    if (!res.headersSent)
      res.status(500).json({ error: "Something went wrong on the server." });
  }
}
