import type { ChatMessage } from "../../shared/chat.ts";

/** A message in the panel, with whether we sent it. */
export interface ChatEntry extends ChatMessage {
  mine: boolean;
}

export interface ChatArrival {
  message: ChatMessage;
  /** We sent it. */
  mine: boolean;
  /** The chat is open and the tab is in view: whoever it is for is reading it. */
  viewing: boolean;
}

export interface ChatAlert {
  /** It adds to the unread count (the badge and the tab title). */
  unread: boolean;
  /** It deserves a toast, and a sound if the player wants one. */
  notify: boolean;
}

/**
 * What a message that just arrived should do on this screen. Only direct
 * messages from somebody else alert: the others are in the panel for whoever
 * is looking. The server marks as quiet what must not make noise (the player
 * asked not to be disturbed): it still counts as unread, silently.
 */
export function alertFor({ message, mine, viewing }: ChatArrival): ChatAlert {
  if (message.scope !== "dm" || mine || viewing)
    return { unread: false, notify: false };
  return { unread: true, notify: !message.quiet };
}

/** The title of the tab: with how many direct messages wait while the tab is hidden. */
export function documentTitle(
  base: string,
  unread: number,
  hidden: boolean,
): string {
  return hidden && unread > 0 ? `(${unread}) ${base}` : base;
}

const TOAST_TEXT_LENGTH = 80;

const shorten = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

/** What the toast says when a direct message arrives. */
export function toastText(message: ChatMessage): string {
  return `${message.name} (direct): ${shorten(message.text, TOAST_TEXT_LENGTH)}`;
}

export interface DesktopAlertInputs {
  /** The player turned them on in the options. */
  enabled: boolean;
  /** What the browser allows: null when it has no notifications at all. */
  permission: string | null;
  hidden: boolean;
  /** The message is one to make noise about (see `alertFor`). */
  notify: boolean;
}

/** Whether to show the browser's own notification: asked for, allowed, and nobody is looking at the tab. */
export function shouldDesktopNotify({
  enabled,
  permission,
  hidden,
  notify,
}: DesktopAlertInputs): boolean {
  return enabled && permission === "granted" && hidden && notify;
}

/** The title and body of the browser's notification. */
export function desktopAlertText(message: ChatMessage): {
  title: string;
  body: string;
} {
  return { title: message.name, body: message.text };
}
