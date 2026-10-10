import type { VoiceState } from "../../game/VoiceChat";

export interface VoiceIndicatorProps {
  state: VoiceState;
  cameraOn: boolean;
  /** Joins the call, or mutes/unmutes once joined. */
  onToggle: () => void;
}
