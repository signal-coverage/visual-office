import { Button } from "@heroui/react";
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
import type { ChatMessage } from "../../shared/chat.ts";
import { FLOOR_UPDATED_CODE } from "../../shared/floors.ts";
import { sanitizeName } from "../../shared/name.ts";
import type { Roster } from "../../shared/roster.ts";
import { BoardHint } from "../components/BoardHint";
import { ChatPanel } from "../components/ChatPanel";
import { ClosingBanner } from "../components/ClosingBanner";
import { DebugOverlay } from "../components/DebugOverlay";
import { LobbyScreen } from "../components/LobbyScreen";
import { ScreenShareBadge } from "../components/ScreenShareBadge";
import { SelfView } from "../components/SelfView";
import { Toast } from "../components/Toast";
import { UserList } from "../components/UserList";
import { VoiceIndicator } from "../components/VoiceIndicator";
import { ZoneIndicator } from "../components/ZoneIndicator";
import { Game, type ScreenShareInfo } from "../game/Game";
import { detectGpuName, isSoftwareRenderer } from "../game/gpu";
import type { VoiceState } from "../game/VoiceChat";
import {
  CONTROLS_HINT,
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
import { loadSettings, saveSettings, type Settings } from "./settings";
import * as styles from "./styles";
import type { AppProps, Phase, SignedInUser } from "./types";

// Its own chunk: it is only needed once somebody opens the menu
const GameMenu = lazy(() =>
  import("../components/GameMenu").then((module) => ({
    default: module.GameMenu,
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
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [message, setMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("unavailable");
  const [micSteps, setMicSteps] = useState(0);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [showRoster, setShowRoster] = useState(true);
  const [zone, setZone] = useState<string | null>(null);
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
        e.target.closest("input, textarea")
      )
        return;
      e.preventDefault();
      setShowRoster((shown) => !shown);
    };
    document.addEventListener("keydown", toggleRoster);
    return () => document.removeEventListener("keydown", toggleRoster);
  }, [phase]);

  // A notice goes away by itself; a new one restarts the countdown
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const readDiagnostics = useCallback(
    () => gameRef.current?.diagnostics() ?? null,
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.dispose();
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setMouseSensitivity(settings.mouseSensitivity);
  }, [settings.mouseSensitivity]);

  // Esc frees the mouse, and a free mouse in the office means the menu (unless it is the chat that took it)
  useEffect(() => {
    if (phase !== "online") return;
    const onLockChange = () => {
      if (document.pointerLockElement === null && !chatOpen.current)
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
            onChat: (chat) =>
              setMessages((prev) =>
                [...prev, chat].slice(-MAX_STORED_MESSAGES),
              ),
            onVoiceState: setVoiceState,
            onMicLevel: setMicSteps,
            onRoster: setRoster,
            onZone: setZone,
            onBoardAim: (aim) => setBoardInk(aim ? aim.ink : null),
            onScreenShare: setScreenShare,
            onNotice: setNotice,
            onCamera: (on, element) => {
              setCameraOn(on);
              setSelfView(element);
            },
            onReconnecting: setReconnecting,
            onFloorClosing: setClosingIn,
            onDisconnected: (code) => {
              setReconnecting(false);
              setZone(null);
              setRoster(null);
              setMicSteps(0);
              setBoardInk(null);
              setScreenShare({ kind: "none" });
              setNotice(null);
              setClosingIn(null);
              setMenuOpen(false);
              // The player left on purpose: back to the first screen, with nothing to apologise for
              if (leaving.current) {
                leaving.current = false;
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
        <div style={styles.gpuWarning} role="alert">
          {SOFTWARE_RENDERING_MESSAGE}
        </div>
      )}

      {phase === "online" ? (
        <>
          <div style={styles.status}>{name}</div>
          {reconnecting && (
            <div style={styles.banner} role="status">
              {RECONNECTING_MESSAGE}
            </div>
          )}
          {settings.showHints && <div style={styles.hint}>{CONTROLS_HINT}</div>}
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
          <ZoneIndicator label={zone} />
          <ClosingBanner key={closingIn ?? "none"} seconds={closingIn} />
          <ScreenShareBadge info={screenShare} />
          <Toast text={notice} />
          <BoardHint ink={boardInk} />
          {showRoster && <UserList roster={roster} />}
          <SelfView element={selfView} />
          <ChatPanel
            messages={messages}
            onSend={(text) => gameRef.current?.sendChat(text)}
            onOpen={() => {
              chatOpen.current = true;
              document.exitPointerLock();
            }}
            onClose={() => {
              chatOpen.current = false;
              gameRef.current?.relock();
            }}
          />
          {menuOpen && (
            <Suspense fallback={null}>
              <GameMenu
                name={name}
                look={look}
                settings={settings}
                onResume={resume}
                onChangeLook={changeLook}
                onChangeSettings={changeSettings}
                onLeave={leaveOffice}
                onSignOut={signedIn?.signOut}
              />
            </Suspense>
          )}
        </>
      ) : (
        // With ?name= in the link the lobby is skipped, except when joining fails
        (!urlName || phase === "offline") && (
          <LobbyScreen
            phase={phase}
            initialName={urlName ?? savedName}
            fixedName={signedIn?.displayName || undefined}
            accountMenu={signedIn?.accountMenu}
            onEditFloor={signedIn?.onEditFloor}
            onManagePeople={signedIn?.onManagePeople}
            onInvitePeople={signedIn?.onInvitePeople}
            initialAppearance={look}
            message={message}
            onJoin={join}
          />
        )
      )}
    </>
  );
}
