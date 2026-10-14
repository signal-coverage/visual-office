import { useEffect, useRef, useState } from "react";
import type { Outcome } from "./content";

/** What is on the screen while something is being brought from the server. */
export type Loaded<T> =
  | { status: "loading" }
  | { status: "error"; text: string }
  | { status: "ready"; value: T };

/**
 * Brings something from the server when `key` changes, and again on `retry`.
 * Answers that arrive after the key changed (or the screen went away) are ignored.
 */
export function useLoaded<T extends object>(
  load: () => Promise<Outcome<T>>,
  key: string,
): { state: Loaded<T>; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<{
    key: string;
    attempt: number;
    outcome: Outcome<T>;
  } | null>(null);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let current = true;
    void latest.current().then((outcome) => {
      if (current) setAnswer({ key, attempt, outcome });
    });
    return () => {
      current = false;
    };
  }, [key, attempt]);

  const state: Loaded<T> =
    !answer || answer.key !== key || answer.attempt !== attempt
      ? { status: "loading" }
      : answer.outcome.ok
        ? { status: "ready", value: answer.outcome }
        : { status: "error", text: answer.outcome.text };
  return { state, retry: () => setAttempt((n) => n + 1) };
}
