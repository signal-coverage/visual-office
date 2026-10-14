import type { VoiceState } from "../../game/VoiceChat";

export interface VoiceIndicatorProps {
  state: VoiceState;
  cameraOn: boolean;
  /** Bars of the microphone meter to light, 0..METER_STEPS. */
  micSteps: number;
  /** Joins the call, or mutes/unmutes once joined. */
  onToggle: () => void;
  /** Classes added to the button (the last Tailwind utility wins): for putting it somewhere other than the corner. */
  className?: string;
  /** What each state says, when the keys of the game do not apply. */
  labels?: Record<VoiceState, string>;
}
