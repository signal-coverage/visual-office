import { Button } from "@heroui/react";
import { cn } from "../../lib/cn";
import { METER_STEPS } from "../../game/micMeter";
import { CAMERA_SUFFIX, VOICE_COLOR, VOICE_LABEL } from "./consts";
import * as styles from "./styles";
import type { VoiceIndicatorProps } from "./types";

const BARS = Array.from({ length: METER_STEPS }, (_, i) => i);

export function VoiceIndicator({
  state,
  cameraOn,
  micSteps,
  onToggle,
  className,
  labels = VOICE_LABEL,
}: VoiceIndicatorProps) {
  if (state === "unavailable") return null;

  return (
    <Button
      variant="ghost"
      className={cn(styles.button, className)}
      onPress={onToggle}
      isDisabled={state === "connecting"}
    >
      <span className={styles.dot(VOICE_COLOR[state])} />
      {labels[state]}
      {cameraOn && CAMERA_SUFFIX}
      {state === "live" && (
        <span
          className={styles.meter}
          role="meter"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={METER_STEPS}
          aria-valuenow={micSteps}
        >
          {BARS.map((bar) => (
            <span
              key={bar}
              className={styles.bar(bar < micSteps, bar)}
              style={styles.barHeight(bar)}
            />
          ))}
        </span>
      )}
    </Button>
  );
}
