import { findShellProblems, sanitizeShell, type Shell } from "./shell.ts";

/**
 * The shell every floor had when it was fixed code, and still the one a floor
 * has when it never chose another: a 30 by 20 meter office with the meeting
 * room (glass walls, a whiteboard and a screen) in the north-west corner, a
 * kitchen, a lounge, a reception and the open area, and the place where people
 * appear at the south end. A test holds it equal to those old constants.
 */
export const DEFAULT_SHELL: Shell = {
  width: 30,
  depth: 20,
  walls: [],
  glass: [
    { x: -6, z: -7.5, width: 0.15, depth: 5 },
    { x: -12, z: -2, width: 6, depth: 0.15 },
  ],
  floors: [
    { x: -10.5, z: -6, width: 8, depth: 7, tone: "meeting" },
    { x: 10.5, z: 6.5, width: 8, depth: 6, tone: "lounge" },
  ],
  zones: [
    {
      id: "meeting",
      label: "Meeting room",
      rect: { minX: -14.85, maxX: -6.075, minZ: -9.85, maxZ: -2.075 },
    },
  ],
  areas: [
    {
      id: "meeting-room",
      label: "Meeting room",
      rect: { minX: -15, maxX: -6, minZ: -10, maxZ: -2 },
    },
    {
      id: "kitchen",
      label: "Kitchen",
      rect: { minX: 6, maxX: 15, minZ: -10, maxZ: -2 },
    },
    {
      id: "lounge",
      label: "Lounge",
      rect: { minX: 6, maxX: 15, minZ: 3, maxZ: 10 },
    },
    {
      id: "reception",
      label: "Reception",
      rect: { minX: -15, maxX: -6, minZ: 3, maxZ: 10 },
    },
    {
      id: "open-area",
      label: "Open area",
      rect: { minX: -15, maxX: 15, minZ: -10, maxZ: 10 },
    },
  ],
  boards: [
    {
      id: "meeting",
      zone: "meeting",
      facing: "east",
      face: -14.85,
      along: -6,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    },
  ],
  screens: [
    {
      id: "meeting",
      zone: "meeting",
      facing: "south",
      face: -9.85,
      along: -10.5,
      y: 1.8,
      width: 3.3,
    },
  ],
  spawn: { area: { minX: -3, maxX: 3, minZ: 7.5, maxZ: 9 }, yaw: 0 },
};

/**
 * The shell a floor really has, from whatever its layout carries: what is
 * stored or received, made safe, and checked once more. Anything that is not a
 * usable shell (nothing, a broken one) is the default shell, so a bad stored
 * value can never leave a floor without walls or without a place to appear.
 */
export function shellOrDefault(raw: unknown): Shell {
  if (raw === undefined || raw === null) return DEFAULT_SHELL;
  const shell = sanitizeShell(raw);
  if (!shell || findShellProblems(shell).length > 0) return DEFAULT_SHELL;
  return shell;
}
