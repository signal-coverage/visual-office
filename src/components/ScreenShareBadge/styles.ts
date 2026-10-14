import { cn } from "../../lib/cn";

export const badge = (mine: boolean) =>
  cn(
    "pointer-events-none fixed left-4 top-32 rounded-xl px-3 py-1.5 text-[13px] font-medium backdrop-blur-md",
    mine
      ? "bg-danger/90 text-danger-foreground"
      : "bg-accent/90 text-accent-foreground",
  );
