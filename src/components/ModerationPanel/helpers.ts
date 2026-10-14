import type { ModerationAction } from "../../../shared/moderation.ts";

/** Removing and banning ask first: one wrong click would send somebody away from their work. */
export function needsConfirmation(action: ModerationAction): boolean {
  return action === "kick" || action === "ban";
}

/** What the moderator is asked before it is done. */
export function confirmQuestion(
  action: ModerationAction,
  name: string,
  minutes: number,
): string {
  return action === "ban"
    ? `Remove ${name} and ban them for ${minutes} minute${minutes === 1 ? "" : "s"}?`
    : `Remove ${name} from the office?`;
}
