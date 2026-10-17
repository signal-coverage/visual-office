import type { Emote } from "../../../shared/emotes.ts";
import type { VoiceState } from "../../game/VoiceChat";
import type { TouchInput } from "../../touch/touchInput";

export interface TouchControlsProps {
  /** Where the fingers on the joystick and the scene go. */
  input: TouchInput;
  /** The menu, the chat, a map or a computer is on screen: the controls are put away. */
  covered: boolean;
  voice: VoiceState;
  /** Bars of the microphone meter to light. */
  micSteps: number;
  cameraOn: boolean;
  seated: boolean;
  /** What the button of use would do where the person looks ("Sit down"), or null when there is nothing to use. */
  action: string | null;
  /** There is more than one room: the map of rooms is offered. */
  canTravel: boolean;
  peopleShown: boolean;
  /** Direct messages not read yet, shown on the chat button. */
  unread: number;
  /** The first-run hint is up. */
  hint: boolean;
  onDismissHint: () => void;
  onMenu: () => void;
  onChat: () => void;
  onVoice: () => void;
  onCamera: () => void;
  onMap: () => void;
  onPeople: () => void;
  onKnock: () => void;
  onEmote: (emote: Emote) => void;
  /** Uses what the person looks at, or gets them up from a seat. */
  onUse: () => void;
}
