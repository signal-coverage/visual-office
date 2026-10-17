/** The keys and what they do: shown on the main menu and in the menu. */
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

/** The same, for a screen with fingers instead of a keyboard and a mouse. */
export const TOUCH_CONTROLS: ReadonlyArray<
  readonly [gesture: string, action: string]
> = [
  ["Left thumb", "Move; push it to the edge to run"],
  ["Right thumb", "Look around"],
  ["Tap", "Use what you tap (sit, read, look); the big button does it too"],
  ["Stand up", "The big button while sitting, or push the joystick"],
  ["Buttons", "Menu, chat, voice, camera, people, rooms, emotes, knock"],
];
