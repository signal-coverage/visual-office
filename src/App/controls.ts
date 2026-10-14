/** The keys and what they do: shown in the lobby and in the menu. */
export const CONTROLS: ReadonlyArray<readonly [keys: string, action: string]> =
  [
    ["W A S D", "Move"],
    ["Shift", "Run"],
    ["Mouse", "Look around"],
    ["Enter", "Chat"],
    ["M", "Join voice / mute"],
    ["C", "Camera on / off"],
    ["P", "Share your screen (meeting room)"],
    ["K", "Knock on a private room's door, or on who you face"],
    [
      "F or click",
      "Use what you look at (sit, read, look); F or Space gets you up",
    ],
    ["Z", "Change your status"],
    ["E + 1 to 5", "Gesture (hold E)"],
    ["R", "Map of rooms (when there is more than one)"],
    ["Tab", "People list"],
    ["Esc", "Menu"],
  ];
