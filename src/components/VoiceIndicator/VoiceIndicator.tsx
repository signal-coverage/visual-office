import { CAMERA_SUFFIX, VOICE_COLOR, VOICE_LABEL } from "./consts";
import * as styles from "./styles";
import type { VoiceIndicatorProps } from "./types";

export function VoiceIndicator({
  state,
  cameraOn,
  onToggle,
}: VoiceIndicatorProps) {
  if (state === "unavailable") return null;

  return (
    <button
      type="button"
      style={styles.button}
      onClick={onToggle}
      disabled={state === "connecting"}
    >
      <span style={styles.dot(VOICE_COLOR[state])} />
      {VOICE_LABEL[state]}
      {cameraOn && CAMERA_SUFFIX}
    </button>
  );
}
