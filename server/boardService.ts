import {
  BOARDS,
  boardById,
  canReachBoard,
  type Board,
} from "../shared/boards.ts";
import { BoardStore, sanitizeStrokeMessage } from "../shared/drawing.ts";
import { RateLimiter } from "./rateLimiter.ts";

/** What the boards need to know about the room, and how they talk to its players. */
export interface BoardHost {
  /** The private zone the player is in, or null. */
  zoneOf: (clientId: string) => string | null;
  positionOf: (clientId: string) => { x: number; z: number } | undefined;
  clientsInZone: (zone: string) => string[];
  send: (clientId: string, type: string, payload: unknown) => void;
}

/** A burst of strokes is normal (a fast scribble); a steady flood is not. */
const DRAW_BURST = 30;
const DRAW_PER_SECOND = 30;
const CLEAR_BURST = 2;
const CLEAR_PER_SECOND = 1;

/**
 * The shared boards: who may draw on them, what they hold, and who gets to see
 * it. A board belongs to a private zone, so what is drawn on it reaches only
 * the people standing in that zone, and somebody who walks in gets what is
 * already there.
 */
export class BoardService {
  private readonly host: BoardHost;
  private readonly stores = new Map<string, BoardStore>();
  private readonly drawLimit: RateLimiter;
  private readonly clearLimit: RateLimiter;

  constructor(host: BoardHost, now: () => number = Date.now) {
    this.host = host;
    this.drawLimit = new RateLimiter(DRAW_BURST, DRAW_PER_SECOND, now);
    this.clearLimit = new RateLimiter(CLEAR_BURST, CLEAR_PER_SECOND, now);
    for (const board of BOARDS) this.stores.set(board.id, new BoardStore());
  }

  /** A piece of a stroke from `author`. Returns whether it was accepted. */
  draw(author: string, raw: unknown): boolean {
    if (!this.drawLimit.allow(author)) return false;
    const message = sanitizeStrokeMessage(raw);
    const board = message && this.boardFor(author, message.board);
    if (!message || !board) return false;

    const accepted = this.stores.get(board.id)!.append(author, message);
    if (!accepted) return false;

    this.tellOthers(author, board, "draw", {
      board: board.id,
      id: accepted.id,
      ink: accepted.ink,
      points: accepted.points,
    });
    return true;
  }

  /** `author` wipes a board. Returns whether it was allowed. */
  clear(author: string, raw: unknown): boolean {
    if (!this.clearLimit.allow(author)) return false;
    const id =
      typeof raw === "object" && raw !== null
        ? (raw as { board?: unknown }).board
        : undefined;
    const board = typeof id === "string" ? this.boardFor(author, id) : null;
    if (!board) return false;

    this.stores.get(board.id)!.clear();
    this.tellOthers(author, board, "clearBoard", { board: board.id });
    return true;
  }

  /** `clientId` just walked into `zone`: show them what is on its boards. */
  enteredZone(clientId: string, zone: string): void {
    for (const board of BOARDS) {
      if (board.zone !== zone) continue;
      this.host.send(clientId, "board", {
        board: board.id,
        strokes: this.stores.get(board.id)!.snapshot(),
      });
    }
  }

  forget(clientId: string): void {
    this.drawLimit.forget(clientId);
    this.clearLimit.forget(clientId);
  }

  /** The board, if `author` is allowed to use it: in its zone and within reach. */
  private boardFor(author: string, boardId: string): Board | null {
    const board = boardById(boardId);
    const position = this.host.positionOf(author);
    if (!board || !position) return null;
    if (this.host.zoneOf(author) !== board.zone) return null;
    return canReachBoard(board, position.x, position.z) ? board : null;
  }

  private tellOthers(
    author: string,
    board: Board,
    type: string,
    payload: unknown,
  ): void {
    for (const id of this.host.clientsInZone(board.zone)) {
      if (id !== author) this.host.send(id, type, payload);
    }
  }
}
