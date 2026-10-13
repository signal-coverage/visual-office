import type { VoiceState } from "../../game/VoiceChat";

export interface VoiceIndicatorProps {
  state: VoiceState;
  cameraOn: boolean;
  /** Bars of the microphone meter to light, 0..METER_STEPS. */
  micSteps: number;
  /** Joins the call, or mutes/unmutes once joined. */
  onToggle: () => void;
}
