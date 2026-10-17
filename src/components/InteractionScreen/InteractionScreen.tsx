import { panelUsesMouse } from "../../../shared/interactions.ts";
import { BookShelf } from "../BookShelf";
import { ComputerScreen } from "../ComputerScreen";
import { InteractionPanel } from "../InteractionPanel";
import type { InteractionScreenProps } from "./types";

/** What the player sees on using something: the screen of a computer, a shelf of books, or a few words. */
export function InteractionScreen({
  panel,
  floor,
  getToken,
  canEdit,
  onClose,
  touch,
}: InteractionScreenProps) {
  const content =
    panel.kind === "computer" ? (
      <ComputerScreen floor={floor} getToken={getToken} canEdit={canEdit} />
    ) : panel.kind === "book" ? (
      <BookShelf floor={floor} getToken={getToken} canEdit={canEdit} />
    ) : (
      panel.body
    );
  return (
    <InteractionPanel
      title={panel.title}
      content={content}
      interactive={panelUsesMouse(panel.kind)}
      onClose={onClose}
      touch={touch}
    />
  );
}
