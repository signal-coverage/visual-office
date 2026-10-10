export type LobbyPhase = "lobby" | "connecting" | "offline";

export interface LobbyScreenProps {
  phase: LobbyPhase;
  initialName: string;
  /** Why the player is back in the lobby (connection failed or dropped). */
  message: string | null;
  onJoin: (name: string) => void;
}
