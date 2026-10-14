import type { ReactNode } from "react";

export interface ErrorBoundaryProps {
  /** Shown in place of the children if one of them throws. */
  fallback: ReactNode;
  children: ReactNode;
}

export interface ErrorBoundaryState {
  failed: boolean;
}
