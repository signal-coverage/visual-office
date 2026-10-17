import { Badge, Button, ToggleButton } from "@heroui/react";
import { useState } from "react";
import {
  EMOTE_ICONS,
  EMOTE_LABELS,
  EMOTES,
  type Emote,
} from "../../../shared/emotes.ts";
import { METER_STEPS } from "../../game/micMeter";
import { TouchHint } from "../TouchHint";
import { TouchPad } from "../TouchPad";
import { VOICE_COLOR } from "../VoiceIndicator/consts";
import {
  EMOTES_BAR_LABEL,
  ICONS,
  LABELS,
  VOICE_ICONS,
  VOICE_LABELS,
} from "./consts";
import * as styles from "./styles";
import type { TouchControlsProps } from "./types";

const BARS = Array.from({ length: METER_STEPS }, (_, i) => i);

/**
 * What a phone has instead of a keyboard and a mouse: a joystick, the scene to
 * drag and tap, a column of buttons for what the keys do, and one big button to
 * use what is in front of the person or to get up. All of it is put away while
 * the menu, the chat, a map or a computer is on screen.
 */
export function TouchControls({
  input,
  covered,
  voice,
  micSteps,
  cameraOn,
  seated,
  action,
  canTravel,
  peopleShown,
  unread,
  hint,
  onDismissHint,
  onMenu,
  onChat,
  onVoice,
  onCamera,
  onMap,
  onPeople,
  onKnock,
  onEmote,
  onUse,
}: TouchControlsProps) {
  const [emotesOpen, setEmotesOpen] = useState(false);
  if (covered) return null;

  const hasVoice = voice !== "unavailable";
  const useLabel = seated ? LABELS.stand : action;

  return (
    <>
      <TouchPad input={input} />
      <div className={styles.column}>
        <Button
          variant="ghost"
          isIconOnly
          aria-label={LABELS.menu}
          className={styles.button()}
          onPress={onMenu}
        >
          <span aria-hidden="true">{ICONS.menu}</span>
        </Button>
        <Badge.Anchor>
          <Button
            variant="ghost"
            isIconOnly
            aria-label={LABELS.chat}
            className={styles.button()}
            onPress={onChat}
          >
            <span aria-hidden="true">{ICONS.chat}</span>
          </Button>
          {unread > 0 && (
            <Badge color="danger" size="sm" className={styles.badge}>
              <Badge.Label>{unread > 9 ? "9+" : unread}</Badge.Label>
            </Badge>
          )}
        </Badge.Anchor>
        {hasVoice && (
          <ToggleButton
            variant="ghost"
            isIconOnly
            aria-label={VOICE_LABELS[voice]}
            isSelected={voice === "live"}
            isDisabled={voice === "connecting"}
            className={styles.button(voice === "live")}
            onChange={onVoice}
          >
            <span aria-hidden="true">{VOICE_ICONS[voice]}</span>
            <span className={styles.voiceDot(VOICE_COLOR[voice])} />
            {voice === "live" && (
              <span
                className={styles.meter}
                role="meter"
                aria-label="Microphone level"
                aria-valuemin={0}
                aria-valuemax={METER_STEPS}
                aria-valuenow={micSteps}
              >
                {BARS.map((bar) => (
                  <span key={bar} className={styles.meterBar(bar < micSteps)} />
                ))}
              </span>
            )}
          </ToggleButton>
        )}
        {hasVoice && (
          <ToggleButton
            variant="ghost"
            isIconOnly
            aria-label={LABELS.camera}
            isSelected={cameraOn}
            className={styles.button(cameraOn)}
            onChange={onCamera}
          >
            <span aria-hidden="true">{ICONS.camera}</span>
          </ToggleButton>
        )}
        <ToggleButton
          variant="ghost"
          isIconOnly
          aria-label={LABELS.people}
          isSelected={peopleShown}
          className={styles.button(peopleShown)}
          onChange={onPeople}
        >
          <span aria-hidden="true">{ICONS.people}</span>
        </ToggleButton>
        {canTravel && (
          <Button
            variant="ghost"
            isIconOnly
            aria-label={LABELS.map}
            className={styles.button()}
            onPress={onMap}
          >
            <span aria-hidden="true">{ICONS.map}</span>
          </Button>
        )}
        <ToggleButton
          variant="ghost"
          isIconOnly
          aria-label={LABELS.emotes}
          isSelected={emotesOpen}
          className={styles.button(emotesOpen)}
          onChange={setEmotesOpen}
        >
          <span aria-hidden="true">{ICONS.emotes}</span>
        </ToggleButton>
        <Button
          variant="ghost"
          isIconOnly
          aria-label={LABELS.knock}
          className={styles.button()}
          onPress={onKnock}
        >
          <span aria-hidden="true">{ICONS.knock}</span>
        </Button>
      </div>
      {emotesOpen && (
        <div
          className={styles.emotes}
          role="group"
          aria-label={EMOTES_BAR_LABEL}
        >
          {EMOTES.map((emote: Emote) => (
            <Button
              key={emote}
              variant="ghost"
              isIconOnly
              aria-label={EMOTE_LABELS[emote]}
              className={styles.emoteButton}
              onPress={() => {
                onEmote(emote);
                setEmotesOpen(false);
              }}
            >
              <span aria-hidden="true">{EMOTE_ICONS[emote]}</span>
            </Button>
          ))}
        </div>
      )}
      {hint && <TouchHint onDismiss={onDismissHint} />}
      {useLabel && (
        <Button className={styles.use} onPress={onUse}>
          {useLabel}
        </Button>
      )}
    </>
  );
}
