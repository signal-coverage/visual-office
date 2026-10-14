export const OFFICE_WIDTH = 30;
export const OFFICE_DEPTH = 20;
export const OFFICE_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.3;

export const PLAYER_RADIUS = 0.4;

export const WALK_SPEED = 4;
export const RUN_SPEED = 7;
/** The fastest a legitimate client can move (m/s). */
export const MAX_SPEED = RUN_SPEED;

/** Where players appear. yaw 0 looks toward -Z (north, into the office). */
export const SPAWN = { x: 0, z: 8.5, yaw: 0 };

export const ROOM_NAME = "office";
export const SERVER_PORT = 2567;
export const MAX_PLAYERS_PER_ROOM = 30;

/** How many times per second the client reports its position. */
export const MOVE_SEND_RATE = 15;
