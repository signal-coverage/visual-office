import { Component } from "react";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "./types";

/**
 * Keeps a failure inside a part of the page (for example a screen that could
 * not be downloaded) from emptying the whole page: React removes everything
 * when an error is not caught.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("A part of the page failed", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
