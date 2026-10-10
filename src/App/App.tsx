import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../shared/chat.ts";
import { sanitizeName } from "../../shared/name.ts";
import { ChatPanel } from "../components/ChatPanel";
import { DebugOverlay } from "../components/DebugOverlay";
import { LobbyScreen } from "../components/LobbyScreen";
import { SelfView } from "../components/SelfView";
import { VoiceIndicator } from "../components/VoiceIndicator";
import { Game } from "../game/Game";
import { detectGpuName, isSoftwareRenderer } from "../game/gpu";
import type { VoiceState } from "../game/VoiceChat";
import {
  CONNECTION_LOST_MESSAGE,
  CONTROLS_HINT,
  DEBUG_KEY,
  MAX_STORED_MESSAGES,
  RECONNECTING_MESSAGE,
  SOFTWARE_RENDERING_MESSAGE,
  UNREACHABLE_MESSAGE,
} from "./consts";
import { debugFromUrl, loadSavedName, nameFromUrl, saveName } from "./helpers";
import * as styles from "./styles";
import type { Phase } from "./types";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [urlName] = useState(nameFromUrl);
  const [savedName] = useState(loadSavedName);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [message, setMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("unavailable");
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

  const join = useCallback((rawName: string) => {
    const game = gameRef.current;
    if (!game) return;
    const playerName = sanitizeName(rawName);
    setName(playerName);
    saveName(playerName);
    setPhase("connecting");
    setMessage(null);
    setReconnecting(false);

    // `gameRef.current !== game` means the component unmounted (or React StrictMode
    // remounted it) while we were connecting: that attempt no longer matters.
    game
      .connect(playerName, {
        onChat: (chat) =>
          setMessages((prev) => [...prev, chat].slice(-MAX_STORED_MESSAGES)),
        onVoiceState: setVoiceState,
        onCamera: (on, element) => {
          setCameraOn(on);
          setSelfView(element);
        },
        onReconnecting: setReconnecting,
        onDisconnected: () => {
          setReconnecting(false);
          setMessage(CONNECTION_LOST_MESSAGE);
          setPhase("offline");
        },
      })
      .then(() => {
        if (gameRef.current !== game) return;
        setPhase("online");
        game.relock();
      })
      .catch((error) => {
        console.warn("Could not join the office room", error);
        if (gameRef.current !== game) return;
        setMessage(UNREACHABLE_MESSAGE);
        setPhase("offline");
      });
  }, []);

  useEffect(() => {
    if (urlName) join(urlName);
  }, [urlName, join]);

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
          <div style={styles.hint}>{CONTROLS_HINT}</div>
          <VoiceIndicator
            state={voiceState}
            cameraOn={cameraOn}
            onToggle={() => gameRef.current?.toggleVoice()}
          />
          <SelfView element={selfView} />
          <ChatPanel
            messages={messages}
            onSend={(text) => gameRef.current?.sendChat(text)}
            onOpen={() => document.exitPointerLock()}
            onClose={() => gameRef.current?.relock()}
          />
        </>
      ) : (
        // With ?name= in the link the lobby is skipped, except when joining fails
        (!urlName || phase === "offline") && (
          <LobbyScreen
            phase={phase}
            initialName={urlName ?? savedName}
            message={message}
            onJoin={join}
          />
        )
      )}
    </>
  );
}
