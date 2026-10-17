import { afterEach, describe, expect, it, vi } from "vitest";
import { setClientReporter } from "../../monitoring/reporter";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  afterEach(() => setClientReporter(null));

  it("starts with nothing failed", () => {
    expect(new ErrorBoundary({ fallback: null, children: null }).state).toEqual(
      { failed: false },
    );
  });

  it("marks itself as failed when something inside it throws, so the rest of the page stays", () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });
  });

  it("tells the error reporter, when there is one, what failed", () => {
    const seen: unknown[][] = [];
    setClientReporter((error, context) => void seen.push([error, context]));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("render failed");
    new ErrorBoundary({ fallback: null, children: null }).componentDidCatch(
      error,
    );
    expect(seen).toEqual([[error, { source: "ErrorBoundary" }]]);
  });
});
