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
import {
  COMMON_FLOOR_ID,
  COMMON_FLOOR_NAME,
  type FloorInfo,
  type FloorMessage,
} from "../../shared/floors.ts";
import { sanitizeName } from "../../shared/name.ts";
import { DEFAULT_STATUS, type Status } from "../../shared/presence.ts";
import {
  panelUsesMouse,
  type PanelContent,
} from "../../shared/interactions.ts";
import { restartRetryDelayMs } from "../../shared/restart.ts";
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
import { withView } from "../lite/device";
import { hintSeen, markHintSeen } from "../touch/hint";
import { TouchInput } from "../touch/touchInput";
import { withToken } from "../calendar/calendar";
import { useRoomNow } from "../calendar/useRoomCalendar";
import { CalendarBadge } from "../components/CalendarBadge";
import { BoardHint } from "../components/BoardHint";
import { ClickPrompt } from "../components/ClickPrompt";
import { ChatPanel } from "../components/ChatPanel";
import { ClosingBanner } from "../components/ClosingBanner";
import { DebugOverlay } from "../components/DebugOverlay";
import { EmoteBar } from "../components/EmoteBar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { FirstScreen } from "../components/FirstScreen";
import { FloorBadge } from "../components/FloorBadge";
import { GameMenu } from "../components/GameMenu";
import { HudColumn } from "../components/HudColumn";
import { InteractHint } from "../components/InteractHint";
import { LoadFailed } from "../components/LoadFailed";
import { LOAD_FAILED } from "../components/LoadFailed/consts";
import { ScreenShareBadge } from "../components/ScreenShareBadge";
import { SelfView } from "../components/SelfView";
import { StatusDot } from "../components/StatusDot";
import { Toast } from "../components/Toast";
import { UserList } from "../components/UserList";
import { VoiceIndicator } from "../components/VoiceIndicator";
import { ZoneIndicator } from "../components/ZoneIndicator";
import { httpUrlOf } from "../editor/backend";
import { fetchFloors } from "../floors/floors";
import {
  afterDisconnect,
  canTravel,
  travelDecision,
  travellingNotice,
} from "../floors/travel";
import { floorFromSearch } from "../floors/search";
import { Game, type ScreenShareInfo } from "../game/Game";
import { detectGpuName, isSoftwareRenderer } from "../game/gpu";
import { currentServerUrl } from "../game/serverAddress";
import type { VoiceState } from "../game/VoiceChat";
import {
  HUD_HINTS,
  MAP_HINT,
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
  messageForJoinError,
  nameFromUrl,
  saveAppearance,
  saveName,
  showClickPrompt,
  touchSceneCovered,
} from "./helpers";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings";
import * as styles from "./styles";
import type { AppProps, Phase, SignedInUser } from "./types";

// Its own chunk: only a device walked with fingers ever downloads the touch controls
const TouchControls = lazy(() =>
  import("../components/TouchControls").then((module) => ({
    default: module.TouchControls,
  })),
);

/** Frees the mouse. A phone has no pointer lock at all, and then there is nothing to free. */
function releaseMouse() {
  if (typeof document.exitPointerLock === "function")
    document.exitPointerLock();
}

// Its own chunk: only opened from the menu
const CalendarView = lazy(() =>
  import("../components/CalendarView").then((module) => ({
    default: module.CalendarView,
  })),
);

// Its own chunk: only opened with its key or from the menu
const RoomsMap = lazy(() =>
  import("../components/RoomsMap").then((module) => ({
    default: module.RoomsMap,
  })),
);

// Its own chunk: only drawn when something is used (with the screens of computers and shelves)
const InteractionScreen = lazy(() =>
  import("../components/InteractionScreen").then((module) => ({
    default: module.InteractionScreen,
  })),
);

export function App({ signedIn, controls = "mouse" }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const touch = controls === "touch";
  /** What fingers on the screen ask for, once there are touch controls; the game reads it every frame. */
  const [touchInput] = useState(() => (touch ? new TouchInput() : null));
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
  /** The map of rooms takes the mouse on purpose too. */
  const mapOpen = useRef(false);
  const [mapShown, setMapShown] = useState(false);
  // The same two facts as state, for what is drawn: the click prompt
  const [mouseLocked, setMouseLocked] = useState(false);
  const [chatShown, setChatShown] = useState(false);
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
  // On a phone the list of people is a button away: it would cover the scene
  const [showRoster, setShowRoster] = useState(!touch);
  const [seated, setSeated] = useState(false);
  /** Counts the presses of the chat button of the touch controls: each one opens the chat. */
  const [chatRequests, setChatRequests] = useState(0);
  const [hintOpen, setHintOpen] = useState(() => touch && !hintSeen());
  /** What the player chose to show as doing (the server may show them as away or busy on top of it). */
  const [chosenStatus, setChosenStatus] = useState<Status>(DEFAULT_STATUS);
  const [emoteKeyHeld, setEmoteKeyHeld] = useState(false);
  /** Whether the server lets this player moderate the floor: it offers the moderation panel in the menu. */
  const [canModerate, setCanModerate] = useState(false);
  const [zone, setZone] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  /** The room the player is in, or was last in: where entering from the first screen goes. */
  const [floor, setFloor] = useState<FloorMessage | null>(null);
  /** The rooms and which of them the player may enter; null until the server has said. */
  const [floors, setFloors] = useState<FloorInfo[] | null>(null);
  const floorsRef = useRef<FloorInfo[] | null>(null);
  /** The room to enter from the first screen: the one in the link, else the last one entered, else the common one. */
  const [linkFloor] = useState(() => floorFromSearch(window.location.search));
  const selectedFloor = useRef(linkFloor ?? COMMON_FLOOR_ID);
  /** The room the player asked to travel to: the disconnection that follows is not an error. */
  const travelTo = useRef<string | null>(null);
  /** After a server restart: which try at joining again this is, or null when the game is not waiting for the server to come back. */
  const restartAttempt = useRef<number | null>(null);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the floor-change callbacks (made once, when joining) need to call now. */
  const floorChanged = useRef(signedIn?.onFloorChange);
  const [boardInk, setBoardInk] = useState<number | null>(null);
  const [interactHint, setInteractHint] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelContent | null>(null);
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
  useEffect(() => {
    floorChanged.current = signedIn?.onFloorChange;
    floorsRef.current = floors;
  });

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

  // No scrolling, pull to refresh or tap highlight on a page that is a game
  useEffect(() => {
    if (!touch) return;
    const root = document.documentElement;
    root.classList.add("touch-office");
    return () => root.classList.remove("touch-office");
  }, [touch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, {
      quality: latest.current.settings.quality,
      softwareRendering,
      touch,
    });
    game.setTouchSource(touchInput);
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      game.dispose();
    };
  }, [softwareRendering, touch, touchInput]);

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
      setMouseLocked(document.pointerLockElement !== null);
      const game = gameRef.current;
      if (document.pointerLockElement !== null) {
        // Taking the mouse back (a click on the scene) puts a computer or a shelf away
        if (game?.interactionUsesMouse) game.closeInteraction();
        return;
      }
      // A computer or a shelf frees the mouse on purpose: it stays until F, Esc or its button
      if (game?.interactionUsesMouse) return;
      // Esc closes what the player is reading before it asks for the menu
      if (game?.interactionOpen) {
        game.closeInteraction();
        return;
      }
      if (
        !chatOpen.current &&
        !mapOpen.current &&
        !gameRef.current?.choosingScreen
      ) {
        gameRef.current?.standUp();
        setMenuOpen(true);
      }
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
  const roomNow = useRoomNow(
    phase === "online" ? zone : null,
    floor?.id ?? COMMON_FLOOR_ID,
    tokenOf,
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  /** The rooms and which of them the player may enter, asked again each time it may have changed. */
  const loadFloors = useCallback(
    () =>
      void fetchFloors(withToken(tokenOf), httpUrlOf(currentServerUrl())).then(
        (found) => {
          if (found) setFloors(found);
        },
      ),
    [tokenOf],
  );
  /** With ?name= in the link the first screen is skipped, except when joining fails or after leaving. */
  const firstScreenShown =
    phase !== "online" && (!urlName || hasLeft || phase === "offline");
  useEffect(() => {
    if (phase === "online" || menuOpen || firstScreenShown) loadFloors();
  }, [phase, menuOpen, firstScreenShown, loadFloors]);

  /** `openMap`, for the game's key callback (made once, when joining) to call now. */
  const openMapRef = useRef<() => void>(() => {});

  /** `join`, for `join` itself to call when the player travels, the floor was updated or access was taken away, and the room has to be entered again. */
  const rejoin = useRef<
    (
      name: string,
      appearance: Appearance,
      target: string,
      notice?: string,
    ) => void
  >(() => {});

  /**
   * Joins a room. From the first screen it is the one selected; when it comes
   * from a room that ended (`inRoom`) the first screen is not shown in between.
   */
  const join = useCallback(
    (
      rawName: string,
      chosen?: Appearance,
      requested?: string,
      inRoom?: { notice?: string },
    ) => {
      const game = gameRef.current;
      if (!game) return;
      const target = requested ?? selectedFloor.current;
      selectedFloor.current = target;
      const playerName = sanitizeName(rawName);
      // A link with ?name= has no menu: use the look saved last time, or one made from the name
      const appearance =
        chosen ?? loadAppearance(defaultAppearance(playerName));
      setName(playerName);
      setLook(appearance);
      saveName(playerName);
      saveAppearance(appearance);
      setPhase(inRoom ? "online" : "connecting");
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
                if (latest.current.settings.notificationSound)
                  playBeep("knock");
              },
              onVoiceState: setVoiceState,
              onMicLevel: setMicSteps,
              onRoster: setRoster,
              onZone: setZone,
              onArea: setArea,
              onBoardAim: (aim) => setBoardInk(aim ? aim.ink : null),
              onInteractHint: setInteractHint,
              onSeatedChange: setSeated,
              onInteractPanel: (next) => {
                setPanel(next);
                // A computer or a shelf is clicked and scrolled: the mouse is let go while it is open
                if (next && panelUsesMouse(next.kind)) releaseMouse();
              },
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
              onMapKey: () => openMapRef.current(),
              onModerator: setCanModerate,
              onFloor: (joined) => {
                setFloor(joined);
                floorChanged.current?.(joined.id);
              },
              onDisconnected: (code) => {
                setReconnecting(false);
                setZone(null);
                setRoster(null);
                setMicSteps(0);
                setBoardInk(null);
                setInteractHint(null);
                setPanel(null);
                setScreenShare({ kind: "none" });
                setNotice(null);
                setClosingIn(null);
                setAlert(null);
                setUnread(0);
                setEmoteKeyHeld(false);
                setCanModerate(false);
                setMenuOpen(false);
                setCalendarOpen(false);
                const traveller = travelTo.current;
                travelTo.current = null;
                const next = afterDisconnect({
                  code,
                  leaving: leaving.current,
                  travelTo: traveller,
                  floor: selectedFloor.current,
                });
                leaving.current = false;
                // The player left on purpose: back to the first screen, with nothing to apologise for
                if (next.kind === "lobby") {
                  setHasLeft(true);
                  setMessage(null);
                  setPhase("lobby");
                  return;
                }
                // Travelling, a new layout, access taken away: straight into a room, with no first screen in between
                if (next.kind === "rejoin" && next.delayMs !== undefined) {
                  restartAttempt.current = 0;
                  setReconnecting(true);
                  restartTimer.current = setTimeout(
                    () =>
                      rejoin.current(
                        playerName,
                        appearance,
                        next.floor,
                        next.notice,
                      ),
                    next.delayMs,
                  );
                  return;
                }
                if (next.kind === "rejoin") {
                  rejoin.current(
                    playerName,
                    appearance,
                    next.floor,
                    next.notice ??
                      (traveller
                        ? travellingNotice(
                            floorsRef.current?.find((f) => f.id === traveller)
                              ?.name ?? traveller,
                          )
                        : undefined),
                  );
                  return;
                }
                setMessage(next.message);
                setPhase("offline");
              },
            },
            token,
            target,
          ),
        )
        .then(() => {
          if (gameRef.current !== game) return;
          restartAttempt.current = null;
          setPhase("online");
          if (inRoom?.notice) setNotice(inRoom.notice);
          game.relock();
        })
        .catch((error) => {
          console.warn("Could not join the office room", error);
          if (gameRef.current !== game) return;
          const attempt = restartAttempt.current;
          const wait =
            attempt === null ? null : restartRetryDelayMs(attempt + 1);
          if (attempt !== null && wait !== null) {
            restartAttempt.current = attempt + 1;
            setReconnecting(true);
            restartTimer.current = setTimeout(
              () =>
                rejoin.current(playerName, appearance, target, inRoom?.notice),
              wait,
            );
            return;
          }
          restartAttempt.current = null;
          setMessage(messageForJoinError(error));
          setPhase("offline");
        });
    },
    [],
  );

  useEffect(() => {
    rejoin.current = (name, appearance, target, notice) =>
      join(name, appearance, target, { notice });
  }, [join]);

  useEffect(() => {
    if (urlName) join(urlName);
  }, [urlName, join]);

  const resume = () => {
    setMenuOpen(false);
    gameRef.current?.relock();
  };
  const showMap = (shown: boolean) => {
    mapOpen.current = shown;
    setMapShown(shown);
  };
  /** Opens the map of rooms (from its key or the menu): it frees the mouse, and does not open the menu behind it. */
  const openMap = () => {
    if (!canTravel(floorsRef.current)) return;
    gameRef.current?.standUp();
    showMap(true);
    setMenuOpen(false);
    releaseMouse();
    loadFloors();
  };
  useEffect(() => {
    openMapRef.current = openMap;
  });
  const closeMap = () => {
    showMap(false);
    gameRef.current?.relock();
  };
  /** Puts a computer or a shelf away and takes the mouse back. */
  const closePanel = useCallback(() => {
    gameRef.current?.closeInteraction();
    gameRef.current?.relock();
  }, []);
  const openMenu = () => {
    gameRef.current?.closeInteraction();
    // With a mouse, Esc frees it and that gets the player out of the seat; a button does not
    if (!touch) gameRef.current?.standUp();
    releaseMouse();
    setMenuOpen(true);
  };
  const goLite = () => {
    window.location.assign(withView(window.location.href, "lite"));
  };
  const dismissHint = () => {
    markHintSeen();
    setHintOpen(false);
  };
  // With the menu, the chat, a map or a computer on screen, fingers belong to them
  const sceneCovered = touchSceneCovered({
    menuOpen,
    chatOpen: chatShown,
    calendarOpen,
    mapOpen: mapShown,
    panelOpen: panel !== null && panelUsesMouse(panel.kind),
  });
  useEffect(() => {
    touchInput?.setEnabled(phase === "online" && !sceneCovered);
  }, [touchInput, phase, sceneCovered]);
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
  /** Asks to travel to another room: the game leaves this one and joins that one, and the server decides at the door. */
  const travel = (target: string) => {
    const decision = travelDecision(floor?.id ?? null, target, floors);
    if (decision.kind === "forbidden") {
      setNotice(decision.text);
      return;
    }
    if (decision.kind !== "travel") return;
    travelTo.current = decision.floor.id;
    showMap(false);
    setMenuOpen(false);
    gameRef.current?.leave();
  };
  const leaveOffice = () => {
    leaving.current = true;
    restartAttempt.current = null;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    setMenuOpen(false);
    gameRef.current?.leave();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={touch ? styles.touchCanvas : styles.canvas}
      />
      {showDebug && <DebugOverlay read={readDiagnostics} />}
      {softwareRendering && (
        <div
          className={touch ? styles.touchGpuWarning : styles.gpuWarning}
          role="alert"
        >
          {SOFTWARE_RENDERING_MESSAGE}
        </div>
      )}

      {phase === "online" ? (
        <>
          <HudColumn touch={touch}>
            <div className={styles.status}>
              <StatusDot status={shownStatus} />
              {name}
            </div>
            <FloorBadge
              name={canTravel(floors) ? (floor?.name ?? null) : null}
            />
            <ZoneIndicator label={zone} area={area} />
            <CalendarBadge text={roomNow} />
            <ScreenShareBadge info={screenShare} />
            {touch && showRoster && <UserList roster={roster} />}
            <SelfView element={selfView} touch={touch} />
          </HudColumn>
          {reconnecting && (
            <div
              className={touch ? styles.touchBanner : styles.banner}
              role="status"
            >
              {RECONNECTING_MESSAGE}
            </div>
          )}
          {settings.showHints && !touch && (
            <div className={styles.hint}>
              {[...HUD_HINTS, ...(canTravel(floors) ? [MAP_HINT] : [])].map(
                ([key, action]) => (
                  <span key={key} className={styles.hintItem}>
                    <Kbd className={styles.hintKey}>{key}</Kbd>
                    {action}
                  </span>
                ),
              )}
            </div>
          )}
          {!touch && (
            <>
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
            </>
          )}
          <ClosingBanner key={closingIn ?? "none"} seconds={closingIn} />
          <Toast text={notice} touch={touch} />
          <Toast text={alert} slot="alert" touch={touch} />
          <BoardHint ink={boardInk} />
          {!touch && <InteractHint text={interactHint} />}
          {panel && (
            <ErrorBoundary fallback={null}>
              <Suspense fallback={null}>
                <InteractionScreen
                  panel={panel}
                  floor={{
                    id: floor?.id ?? COMMON_FLOOR_ID,
                    name: floor?.name ?? COMMON_FLOOR_NAME,
                  }}
                  getToken={tokenOf}
                  canEdit={!!signedIn?.onManageContent}
                  onClose={closePanel}
                  touch={touch}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          <ClickPrompt
            shown={showClickPrompt({
              online: phase === "online",
              locked: mouseLocked,
              menuOpen,
              chatOpen: chatShown,
              calendarOpen,
              mapOpen: mapShown,
              panelOpen: panel !== null && panelUsesMouse(panel.kind),
              touch,
            })}
          />
          {!touch && <EmoteBar shown={emoteKeyHeld} />}
          {!touch && showRoster && <UserList roster={roster} />}
          {touchInput && (
            <ErrorBoundary
              fallback={
                <LoadFailed
                  closeLabel={LOAD_FAILED.reload}
                  onClose={() => window.location.reload()}
                />
              }
            >
              <Suspense fallback={null}>
                <TouchControls
                  input={touchInput}
                  covered={sceneCovered}
                  voice={voiceState}
                  micSteps={micSteps}
                  cameraOn={cameraOn}
                  seated={seated}
                  action={interactHint}
                  canTravel={canTravel(floors)}
                  peopleShown={showRoster}
                  unread={unread}
                  hint={hintOpen}
                  onDismissHint={dismissHint}
                  onMenu={openMenu}
                  onChat={() => setChatRequests((n) => n + 1)}
                  onVoice={() => gameRef.current?.toggleVoice()}
                  onCamera={() => gameRef.current?.toggleCamera()}
                  onMap={openMap}
                  onPeople={() => setShowRoster((shown) => !shown)}
                  onKnock={() => gameRef.current?.knock()}
                  onEmote={(emote) => gameRef.current?.emote(emote)}
                  onUse={() => gameRef.current?.useOrStand()}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          <ChatPanel
            messages={messages}
            people={people}
            unread={unread}
            onSend={sendChat}
            onOpen={releaseMouse}
            onClose={() => gameRef.current?.relock()}
            touch={touch}
            openRequest={chatRequests}
            onOpenChange={(open) => {
              chatOpen.current = open;
              setChatShown(open);
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
              touch={touch}
              onLite={touch ? goLite : undefined}
              onResume={resume}
              onChangeLook={changeLook}
              onChangeSettings={changeSettings}
              onLeave={leaveOffice}
              onSignOut={signedIn?.signOut}
              rooms={
                canTravel(floors)
                  ? {
                      floors,
                      current: floor?.id ?? null,
                      onTravel: travel,
                      onOpenMap: openMap,
                    }
                  : undefined
              }
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
          {mapShown && floors && (
            <ErrorBoundary fallback={<LoadFailed onClose={closeMap} />}>
              <Suspense fallback={null}>
                <RoomsMap
                  floors={floors}
                  current={floor?.id ?? null}
                  getToken={tokenOf}
                  onTravel={travel}
                  onClose={closeMap}
                />
              </Suspense>
            </ErrorBoundary>
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
        firstScreenShown && (
          <FirstScreen
            phase={phase}
            initialName={
              name || (urlName ?? (savedName || signedIn?.displayName || ""))
            }
            fixedName={
              signedIn?.canEditName
                ? undefined
                : signedIn?.displayName || undefined
            }
            initialAppearance={look}
            message={message}
            floors={floors}
            lastFloor={floor?.id ?? linkFloor ?? COMMON_FLOOR_ID}
            getToken={tokenOf}
            accountMenu={signedIn?.accountMenu}
            admin={{
              onEditFloor: signedIn?.onEditFloor,
              onManagePeople: signedIn?.onManagePeople,
              onInvitePeople: signedIn?.onInvitePeople,
              onOpenSettings: signedIn?.onOpenSettings,
              onOpenActivity: signedIn?.onOpenActivity,
              onOpenCalendars: signedIn?.onOpenCalendars,
              onManageRooms: signedIn?.onManageRooms,
              onManageGroups: signedIn?.onManageGroups,
              onManageContent: signedIn?.onManageContent,
            }}
            onSignOut={signedIn?.signOut}
            touch={touch}
            onJoin={join}
            onRefreshFloors={loadFloors}
          />
        )
      )}
    </>
  );
}
