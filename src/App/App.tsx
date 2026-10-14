import { Button, Kbd } from "@heroui/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  defaultAppearance,
  randomAppearance,
  type Appearance,
} from "../../shared/appearance.ts";
import type { ChatScope } from "../../shared/chat.ts";
import type { Emote } from "../../shared/emotes.ts";
import { FLOOR_UPDATED_CODE } from "../../shared/floors.ts";
import { sanitizeName } from "../../shared/name.ts";
import { DEFAULT_STATUS, type Status } from "../../shared/presence.ts";
import type { Roster } from "../../shared/roster.ts";
import {
  alertFor,
  documentTitle,
  shouldDesktopNotify,
  toastText,
  type ChatEntry,
} from "../chat/alerts";
import {
  desktopPermission,
  requestDesktopPermission,
  showDesktopNotification,
} from "../chat/desktop";
import { playBeep } from "../chat/sound";
import { useRoomNow } from "../calendar/useRoomCalendar";
import { CalendarBadge } from "../components/CalendarBadge";
import { BoardHint } from "../components/BoardHint";
import { ChatPanel } from "../components/ChatPanel";
import { ClosingBanner } from "../components/ClosingBanner";
import { DebugOverlay } from "../components/DebugOverlay";
import { EmoteBar } from "../components/EmoteBar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { GameMenu } from "../components/GameMenu";
import { LoadFailed } from "../components/LoadFailed";
import { LobbyScreen } from "../components/LobbyScreen";
import { ScreenShareBadge } from "../components/ScreenShareBadge";
import { SelfView } from "../components/SelfView";
import { StatusDot } from "../components/StatusDot";
import { Toast } from "../components/Toast";
import { UserList } from "../components/UserList";
import { VoiceIndicator } from "../components/VoiceIndicator";
import { ZoneIndicator } from "../components/ZoneIndicator";
import { Game, type ScreenShareInfo } from "../game/Game";
import { detectGpuName, isSoftwareRenderer } from "../game/gpu";
import type { VoiceState } from "../game/VoiceChat";
import {
  HUD_HINTS,
  DEBUG_KEY,
  MAX_STORED_MESSAGES,
  NOTICE_MS,
  RECONNECTING_MESSAGE,
  ROSTER_KEY,
  SOFTWARE_RENDERING_MESSAGE,
} from "./consts";
import {
  debugFromUrl,
  loadAppearance,
  loadSavedName,
  messageForDisconnect,
  messageForJoinError,
  nameFromUrl,
  saveAppearance,
  saveName,
} from "./helpers";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings";
import * as styles from "./styles";
import type { AppProps, Phase, SignedInUser } from "./types";

// Its own chunk: only opened from the menu
const CalendarView = lazy(() =>
  import("../components/CalendarView").then((module) => ({
    default: module.CalendarView,
  })),
);

export function App({ signedIn }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [urlName] = useState(nameFromUrl);
  const [savedName] = useState(loadSavedName);
  // First visit: a random look, so the menu starts with somebody rather than a blank
  // The look kept on the server wins (it follows the person to any browser), then this browser's
  const [look, setLook] = useState(
    () => signedIn?.appearance ?? loadAppearance(randomAppearance()),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  /** The chat takes the mouse too: that must not open the menu. */
  const chatOpen = useRef(false);
  /** Set when the player chose to leave, so the game goes to the first screen and not to an error. */
  const leaving = useRef(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [message, setMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  /** Direct messages that arrived while the chat was not being read. */
  const [unread, setUnread] = useState(0);
  const [tabHidden, setTabHidden] = useState(() => document.hidden);
  /** A direct message or a knock, shown below the usual notices. */
  const [alert, setAlert] = useState<string | null>(null);
  /** What the chat callbacks (made once, when joining) need to know now. */
  const latest = useRef({ settings: DEFAULT_SETTINGS });
  const baseTitle = useRef(document.title);
  const [voiceState, setVoiceState] = useState<VoiceState>("unavailable");
  const [micSteps, setMicSteps] = useState(0);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [showRoster, setShowRoster] = useState(true);
  /** What the player chose to show as doing (the server may show them as away or busy on top of it). */
  const [chosenStatus, setChosenStatus] = useState<Status>(DEFAULT_STATUS);
  const [emoteKeyHeld, setEmoteKeyHeld] = useState(false);
  /** Whether the server lets this player moderate the floor: it offers the moderation panel in the menu. */
  const [canModerate, setCanModerate] = useState(false);
  const [zone, setZone] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [boardInk, setBoardInk] = useState<number | null>(null);
  const [screenShare, setScreenShare] = useState<ScreenShareInfo>({
    kind: "none",
  });
  const [notice, setNotice] = useState<string | null>(null);
  /** Seconds until the floor closes for editing, or null when it is not about to. */
  const [closingIn, setClosingIn] = useState<number | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [selfView, setSelfView] = useState<HTMLVideoElement | null>(null);
  const [showDebug, setShowDebug] = useState(debugFromUrl);
  const [softwareRendering] = useState(() =>
    isSoftwareRenderer(detectGpuName()),
  );

  useEffect(() => {
    const toggleDebug = (e: KeyboardEvent) => {
      if (e.code !== DEBUG_KEY) return;
      e.preventDefault(); // F3 would otherwise open the browser's find bar
      setShowDebug((shown) => !shown);
    };
    document.addEventListener("keydown", toggleDebug);
    return () => document.removeEventListener("keydown", toggleDebug);
  }, []);

  useEffect(() => {
    if (phase !== "online") return;
    const toggleRoster = (e: KeyboardEvent) => {
      if (e.code !== ROSTER_KEY) return;
      // Tab keeps its usual job while typing in the chat
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea, [data-chat]")
      )
        return;
      e.preventDefault();
      setShowRoster((shown) => !shown);
    };
    document.addEventListener("keydown", toggleRoster);
    return () => document.removeEventListener("keydown", toggleRoster);
  }, [phase]);

  useEffect(() => {
    latest.current.settings = settings;
  }, [settings]);

  // Whether the tab is in view decides if the chat is being read, and the title counts what is waiting
  useEffect(() => {
    const onVisibility = () => {
      setTabHidden(document.hidden);
      if (!document.hidden && chatOpen.current) setUnread(0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    const base = baseTitle.current;
    document.title = documentTitle(base, unread, tabHidden);
    return () => {
      document.title = base;
    };
  }, [unread, tabHidden]);

  // A notice goes away by itself; a new one restarts the countdown
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [alert]);

  /** What everybody sees the player as, from the room's list: it is the choice, unless they are away or in a meeting. */
  const shownStatus =
    roster?.entries.find((entry) => entry.you)?.status ?? chosenStatus;

  /** Everybody else the player can see, for the one a direct message goes to. */
  const people =
    roster?.entries
      .filter((entry) => !entry.you)
      .map(({ id, name, status }) => ({ id, name, status })) ?? [];

  const readDiagnostics = useCallback(
    () => gameRef.current?.diagnostics() ?? null,
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, {
      quality: latest.current.settings.quality,
      softwareRendering,
    });
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.dispose();
    };
  }, [softwareRendering]);

  useEffect(() => {
    gameRef.current?.setQuality(settings.quality);
  }, [settings.quality]);

  useEffect(() => {
    gameRef.current?.setMouseSensitivity(settings.mouseSensitivity);
  }, [settings.mouseSensitivity]);

  // Esc frees the mouse, and a free mouse in the office means the menu (unless it is the chat that took it)
  useEffect(() => {
    if (phase !== "online") return;
    const onLockChange = () => {
      if (
        document.pointerLockElement === null &&
        !chatOpen.current &&
        !gameRef.current?.choosingScreen
      )
        setMenuOpen(true);
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () =>
      document.removeEventListener("pointerlockchange", onLockChange);
  }, [phase]);

  /** How to ask for a fresh sign-in token, when there is sign-in. Kept in a ref so `join` stays the same function. */
  const getToken = useRef<SignedInUser["getToken"] | null>(null);
  useEffect(() => {
    getToken.current = signedIn?.getToken ?? null;
  });

  /** The same, for the calendar: a function that does not change. */
  const tokenOf = useCallback(
    () => getToken.current?.() ?? Promise.resolve(null),
    [],
  );
  const roomNow = useRoomNow(phase === "online" ? zone : null, tokenOf);
  const [calendarOpen, setCalendarOpen] = useState(false);

  /** `join`, for `join` itself to call when the floor was updated and has to be entered again. */
  const rejoin = useRef<(name: string, appearance: Appearance) => void>(
    () => {},
  );

  const join = useCallback((rawName: string, chosen?: Appearance) => {
    const game = gameRef.current;
    if (!game) return;
    const playerName = sanitizeName(rawName);
    // A link with ?name= has no menu: use the look saved last time, or one made from the name
    const appearance = chosen ?? loadAppearance(defaultAppearance(playerName));
    setName(playerName);
    setLook(appearance);
    saveName(playerName);
    saveAppearance(appearance);
    setPhase("connecting");
    setMessage(null);
    setMenuOpen(false);
    setReconnecting(false);
    setZone(null);
    setRoster(null);
    setMicSteps(0);
    setClosingIn(null);

    // `gameRef.current !== game` means the component unmounted (or React StrictMode
    // remounted it) while we were connecting: that attempt no longer matters.
    // The token is asked for now, not before: it only lasts a minute
    (getToken.current?.() ?? Promise.resolve(null))
      .then((token) =>
        game.connect(
          playerName,
          appearance,
          {
            onChat: (chat, mine) => {
              setMessages((prev) =>
                [...prev, { ...chat, mine }].slice(-MAX_STORED_MESSAGES),
              );
              const { unread: counts, notify } = alertFor({
                message: chat,
                mine,
                viewing: chatOpen.current && !document.hidden,
              });
              if (counts) setUnread((n) => n + 1);
              if (!notify) return;
              const { settings: current } = latest.current;
              setAlert(toastText(chat));
              if (current.notificationSound) playBeep("message");
              if (
                shouldDesktopNotify({
                  enabled: current.desktopNotifications,
                  permission: desktopPermission(),
                  hidden: document.hidden,
                  notify,
                })
              )
                showDesktopNotification(chat);
            },
            onKnock: (text) => {
              setAlert(text);
              if (latest.current.settings.notificationSound) playBeep("knock");
            },
            onVoiceState: setVoiceState,
            onMicLevel: setMicSteps,
            onRoster: setRoster,
            onZone: setZone,
            onArea: setArea,
            onBoardAim: (aim) => setBoardInk(aim ? aim.ink : null),
            onScreenShare: setScreenShare,
            onNotice: setNotice,
            onCamera: (on, element) => {
              setCameraOn(on);
              setSelfView(element);
            },
            onReconnecting: setReconnecting,
            onFloorClosing: setClosingIn,
            onStatusChosen: setChosenStatus,
            onEmoteKey: setEmoteKeyHeld,
            onModerator: setCanModerate,
            onDisconnected: (code) => {
              setReconnecting(false);
              setZone(null);
              setRoster(null);
              setMicSteps(0);
              setBoardInk(null);
              setScreenShare({ kind: "none" });
              setNotice(null);
              setClosingIn(null);
              setAlert(null);
              setUnread(0);
              setEmoteKeyHeld(false);
              setCanModerate(false);
              setMenuOpen(false);
              setCalendarOpen(false);
              // The player left on purpose: back to the first screen, with nothing to apologise for
              if (leaving.current) {
                leaving.current = false;
                setHasLeft(true);
                setMessage(null);
                setPhase("lobby");
                return;
              }
              // A new layout was published: come back to a room made from it
              if (code === FLOOR_UPDATED_CODE) {
                rejoin.current(playerName, appearance);
                return;
              }
              setMessage(messageForDisconnect(code));
              setPhase("offline");
            },
          },
          token,
        ),
      )
      .then(() => {
        if (gameRef.current !== game) return;
        setPhase("online");
        game.relock();
      })
      .catch((error) => {
        console.warn("Could not join the office room", error);
        if (gameRef.current !== game) return;
        setMessage(messageForJoinError(error));
        setPhase("offline");
      });
  }, []);

  useEffect(() => {
    rejoin.current = join;
  }, [join]);

  useEffect(() => {
    if (urlName) join(urlName);
  }, [urlName, join]);

  const resume = () => {
    setMenuOpen(false);
    gameRef.current?.relock();
  };
  const openMenu = () => {
    document.exitPointerLock();
    setMenuOpen(true);
  };
  /** A new look: seen by everybody, kept on the server (and on this browser, for when there is no sign-in). */
  const changeLook = (next: Appearance) => {
    setLook(next);
    saveAppearance(next);
    gameRef.current?.changeLook(next);
  };
  const changeStatus = (next: Status) => {
    gameRef.current?.setStatus(next);
  };
  const knock = () => {
    gameRef.current?.knock();
    resume();
  };
  const sendChat = (text: string, scope: ChatScope, to?: string) =>
    gameRef.current?.sendChat(text, scope, to);
  /** Turning the browser's notifications on asks for permission, which only works right after the player's click. */
  const toggleDesktopNotifications = (on: boolean) => {
    if (!on) {
      changeSettings({ ...settings, desktopNotifications: false });
      return;
    }
    void requestDesktopPermission().then((granted) =>
      changeSettings({ ...settings, desktopNotifications: granted }),
    );
  };
  const makeEmote = (emote: Emote) => {
    gameRef.current?.emote(emote);
    resume();
  };
  const changeSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };
  const leaveOffice = () => {
    leaving.current = true;
    setMenuOpen(false);
    gameRef.current?.leave();
  };

  return (
    <>
      <canvas ref={canvasRef} style={styles.canvas} />
      {showDebug && <DebugOverlay read={readDiagnostics} />}
      {softwareRendering && (
        <div className={styles.gpuWarning} role="alert">
          {SOFTWARE_RENDERING_MESSAGE}
        </div>
      )}

      {phase === "online" ? (
        <>
          <div className={styles.status}>
            <StatusDot status={shownStatus} />
            {name}
          </div>
          {reconnecting && (
            <div className={styles.banner} role="status">
              {RECONNECTING_MESSAGE}
            </div>
          )}
          {settings.showHints && (
            <div className={styles.hint}>
              {HUD_HINTS.map(([key, action]) => (
                <span key={key} className={styles.hintItem}>
                  <Kbd className={styles.hintKey}>{key}</Kbd>
                  {action}
                </span>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            className={styles.menuButton}
            onPress={openMenu}
          >
            Menu (Esc)
          </Button>
          <VoiceIndicator
            state={voiceState}
            cameraOn={cameraOn}
            micSteps={micSteps}
            onToggle={() => gameRef.current?.toggleVoice()}
          />
          <ZoneIndicator label={zone} area={area} />
          <CalendarBadge text={roomNow} />
          <ClosingBanner key={closingIn ?? "none"} seconds={closingIn} />
          <ScreenShareBadge info={screenShare} />
          <Toast text={notice} />
          <Toast text={alert} slot="alert" />
          <BoardHint ink={boardInk} />
          <EmoteBar shown={emoteKeyHeld} />
          {showRoster && <UserList roster={roster} />}
          <SelfView element={selfView} />
          <ChatPanel
            messages={messages}
            people={people}
            unread={unread}
            onSend={sendChat}
            onOpen={() => document.exitPointerLock()}
            onClose={() => gameRef.current?.relock()}
            onOpenChange={(open) => {
              chatOpen.current = open;
              if (open && !document.hidden) setUnread(0);
            }}
          />
          {menuOpen && !calendarOpen && (
            <GameMenu
              name={name}
              look={look}
              settings={settings}
              status={chosenStatus}
              shownStatus={shownStatus}
              onChangeStatus={changeStatus}
              onEmote={makeEmote}
              onKnock={knock}
              onOpenCalendar={() => setCalendarOpen(true)}
              onToggleDesktopNotifications={toggleDesktopNotifications}
              onResume={resume}
              onChangeLook={changeLook}
              onChangeSettings={changeSettings}
              onLeave={leaveOffice}
              onSignOut={signedIn?.signOut}
              moderation={
                canModerate
                  ? {
                      people,
                      onAct: (action, target, minutes) =>
                        gameRef.current?.moderate(action, target, minutes),
                    }
                  : undefined
              }
            />
          )}
          {calendarOpen && (
            <ErrorBoundary
              fallback={<LoadFailed onClose={() => setCalendarOpen(false)} />}
            >
              <Suspense fallback={null}>
                <CalendarView
                  getToken={tokenOf}
                  onClose={() => setCalendarOpen(false)}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </>
      ) : (
        // With ?name= in the link the lobby is skipped, except when joining fails or after leaving
        (!urlName || hasLeft || phase === "offline") && (
          <LobbyScreen
            phase={phase}
            initialName={urlName ?? (savedName || signedIn?.displayName || "")}
            fixedName={
              signedIn?.canEditName
                ? undefined
                : signedIn?.displayName || undefined
            }
            accountMenu={signedIn?.accountMenu}
            onEditFloor={signedIn?.onEditFloor}
            onManagePeople={signedIn?.onManagePeople}
            onInvitePeople={signedIn?.onInvitePeople}
            onOpenSettings={signedIn?.onOpenSettings}
            onOpenActivity={signedIn?.onOpenActivity}
            onOpenCalendars={signedIn?.onOpenCalendars}
            initialAppearance={look}
            message={message}
            onJoin={join}
          />
        )
      )}
    </>
  );
}
