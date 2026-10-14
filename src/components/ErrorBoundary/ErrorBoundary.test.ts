import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
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
});
