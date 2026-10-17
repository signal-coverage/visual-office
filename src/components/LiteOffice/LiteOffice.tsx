import {
  Alert,
  Button,
  Description,
  Form,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { floorFromSearch } from "../../floors/search";
import { defaultAppearance } from "../../../shared/appearance.ts";
import type { ChatScope } from "../../../shared/chat.ts";
import { MAX_NAME_LENGTH, sanitizeName } from "../../../shared/name.ts";
import type { Roster } from "../../../shared/roster.ts";
import { MAX_STORED_MESSAGES, NOTICE_MS } from "../../App/consts";
import {
  loadAppearance,
  loadSavedName,
  messageForDisconnect,
  messageForJoinError,
  saveAppearance,
  saveName,
} from "../../App/helpers";
import { alertFor, toastText, type ChatEntry } from "../../chat/alerts";
import type { VoiceState } from "../../game/VoiceChat";
import { LITE_REASON_TEXT } from "../../lite/device";
import { LiteSession } from "../../lite/LiteSession";
import { ChatPanel } from "../ChatPanel";
import { ErrorBoundary } from "../ErrorBoundary";
import { LoadFailed } from "../LoadFailed";
import { Toast } from "../Toast";
import { UserList } from "../UserList";
import { VoiceIndicator } from "../VoiceIndicator";
import {
  BUTTON_LABEL,
  CALENDARS_LABEL,
  INCLUDED,
  INCLUDED_TITLE,
  LEAVE_LABEL,
  MISSING,
  MISSING_TITLE,
  NAME_LABEL,
  NAME_LOCKED_HINT,
  NAME_PLACEHOLDER,
  ONLINE_NOTE,
  RECONNECTING_MESSAGE,
  SIGN_OUT_LABEL,
  SUBTITLE,
  TITLE,
  TRY_OFFICE_LABEL,
  VOICE_LABELS,
  VOICE_UNAVAILABLE,
} from "./consts";
import * as styles from "./styles";
import type { LiteOfficeProps, LitePhase } from "./types";

// Its own chunk: only opened from the screen
const CalendarView = lazy(() =>
  import("../CalendarView").then((module) => ({
    default: module.CalendarView,
  })),
);

const noToken = () => Promise.resolve(null);

/** What this screen does and does not do: said plainly, so nobody expects the rest. */
function Lists() {
  return (
    <div className={styles.lists}>
      <div>
        <h2 className={styles.listTitle}>{INCLUDED_TITLE}</h2>
        <ul className={styles.list}>
          {INCLUDED.map((text) => (
            <li key={text} className={styles.listItem}>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className={styles.listTitle}>{MISSING_TITLE}</h2>
        <ul className={styles.list}>
          {MISSING.map((text) => (
            <li key={text} className={styles.listItem}>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The office for a device that cannot show it in 3D: who is online, the chat,
 * the room calendars and the voice call, in the same room as everybody else.
 */
export function LiteOffice({ reason, signedIn, onTryOffice }: LiteOfficeProps) {
  const sessionRef = useRef<LiteSession | null>(null);
  const leaving = useRef(false);
  const chatOpen = useRef(false);
  const [typedName, setTypedName] = useState(
    () => loadSavedName() || signedIn?.displayName || "",
  );
  const fixedName =
    signedIn && !signedIn.canEditName
      ? signedIn.displayName || undefined
      : undefined;
  const [phase, setPhase] = useState<LitePhase>("lobby");
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("unavailable");
  /** Why the call failed, as long as it has: it stays beside the voice button instead of fading like a notice. */
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceStateRef = useRef<VoiceState>("unavailable");
  const [micSteps, setMicSteps] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  const getToken = signedIn?.getToken ?? noToken;
  const tokenOf = useCallback(() => getToken(), [getToken]);

  useEffect(() => {
    return () => sessionRef.current?.dispose();
  }, []);

  // Anything the person does shows they are there: the server marks them away after a while without
  useEffect(() => {
    if (phase !== "online") return;
    const touch = () => sessionRef.current?.touch();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const event of events) document.addEventListener(event, touch);
    return () => {
      for (const event of events) document.removeEventListener(event, touch);
    };
  }, [phase]);

  const join = (rawName: string) => {
    sessionRef.current?.dispose();
    const session = new LiteSession();
    sessionRef.current = session;
    const playerName = sanitizeName(rawName);
    const appearance =
      signedIn?.appearance ?? loadAppearance(defaultAppearance(playerName));
    setName(playerName);
    saveName(playerName);
    saveAppearance(appearance);
    setPhase("connecting");
    setMessage(null);
    setRoster(null);
    setMessages([]);
    setUnread(0);
    setVoiceState("unavailable");
    voiceStateRef.current = "unavailable";
    setVoiceError(null);
    setMicSteps(0);
    setReconnecting(false);

    getToken()
      .then((token) =>
        session.connect(
          playerName,
          appearance,
          {
            onChat: (chat, mine) => {
              setMessages((previous) =>
                [...previous, { ...chat, mine }].slice(-MAX_STORED_MESSAGES),
              );
              const { unread: counts, notify } = alertFor({
                message: chat,
                mine,
                viewing: chatOpen.current && !document.hidden,
              });
              if (counts) setUnread((n) => n + 1);
              if (notify) setAlert(toastText(chat));
            },
            onRoster: setRoster,
            onVoiceState: (state) => {
              voiceStateRef.current = state;
              setVoiceState(state);
              if (state !== "error") setVoiceError(null);
            },
            onMicLevel: setMicSteps,
            onNotice: (text) => {
              if (voiceStateRef.current === "error") setVoiceError(text);
              else setNotice(text);
            },
            onReconnecting: setReconnecting,
            onDisconnected: (code) => {
              setReconnecting(false);
              setRoster(null);
              setCalendarOpen(false);
              if (leaving.current) {
                leaving.current = false;
                setMessage(null);
                setPhase("lobby");
                return;
              }
              setMessage(messageForDisconnect(code));
              setPhase("offline");
            },
          },
          token,
          floorFromSearch(window.location.search) ?? undefined,
        ),
      )
      .then(() => {
        if (sessionRef.current === session) setPhase("online");
      })
      .catch((error) => {
        console.warn("Could not join the office room", error);
        if (sessionRef.current !== session) return;
        setMessage(messageForJoinError(error));
        setPhase("offline");
      });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (phase !== "connecting") join(fixedName ?? typedName);
  };

  const people =
    roster?.entries
      .filter((entry) => !entry.you)
      .map(({ id, name: personName, status }) => ({
        id,
        name: personName,
        status,
      })) ?? [];

  if (phase !== "online") {
    return (
      <div className={styles.backdrop}>
        <div className={styles.card}>
          {signedIn?.accountMenu && (
            <div className={styles.accountMenu}>{signedIn.accountMenu}</div>
          )}
          <header>
            <p className={styles.eyebrow}>Visual Office</p>
            <h1 className={styles.title}>{TITLE}</h1>
            <p className={styles.subtitle}>{SUBTITLE}</p>
          </header>
          <p className={styles.reason}>{LITE_REASON_TEXT[reason]}</p>
          <Lists />
          <Form className={styles.form} onSubmit={handleSubmit}>
            <TextField
              className={styles.field}
              value={fixedName ?? typedName}
              isReadOnly={fixedName !== undefined}
              onChange={setTypedName}
            >
              <Label>{NAME_LABEL}</Label>
              <Input
                fullWidth
                maxLength={MAX_NAME_LENGTH}
                placeholder={NAME_PLACEHOLDER}
                autoComplete="off"
              />
              {fixedName !== undefined && (
                <Description>{NAME_LOCKED_HINT}</Description>
              )}
            </TextField>
            <Button
              type="submit"
              fullWidth
              size="lg"
              className={styles.submit}
              isDisabled={phase === "connecting"}
            >
              {BUTTON_LABEL[phase]}
            </Button>
            {onTryOffice && (
              <Button
                variant="secondary"
                size="sm"
                isDisabled={phase === "connecting"}
                onPress={onTryOffice}
              >
                {TRY_OFFICE_LABEL}
              </Button>
            )}
          </Form>
          {message && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{message}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stage}>
      <div className={styles.room}>
        <div className={styles.bar}>
          <p className={styles.who}>
            {ONLINE_NOTE} <strong>{name}</strong>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setCalendarOpen(true)}
          >
            {CALENDARS_LABEL}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              leaving.current = true;
              sessionRef.current?.leave();
            }}
          >
            {LEAVE_LABEL}
          </Button>
          {signedIn?.signOut && (
            <Button variant="secondary" size="sm" onPress={signedIn.signOut}>
              {SIGN_OUT_LABEL}
            </Button>
          )}
        </div>
        {reconnecting && (
          <p className={styles.banner} role="status">
            {RECONNECTING_MESSAGE}
          </p>
        )}
        <VoiceIndicator
          state={voiceState}
          cameraOn={false}
          micSteps={micSteps}
          onToggle={() => sessionRef.current?.toggleVoice()}
          className={styles.voiceInPlace}
          labels={VOICE_LABELS}
        />
        {voiceState === "error" && voiceError && (
          <p className={styles.voiceNote} role="status">
            {voiceError}
          </p>
        )}
        {voiceState === "unavailable" && (
          <p className={styles.voiceNote} role="status">
            {VOICE_UNAVAILABLE}
          </p>
        )}
        <UserList roster={roster} className={styles.inPlace} />
        <Lists />
      </div>
      <Toast text={notice} />
      <Toast text={alert} slot="alert" />
      <ChatPanel
        messages={messages}
        people={people}
        unread={unread}
        onSend={(text: string, scope: ChatScope, to?: string) =>
          sessionRef.current?.sendChat(text, scope, to)
        }
        onOpen={() => {}}
        onClose={() => {}}
        onOpenChange={(open) => {
          chatOpen.current = open;
          if (open && !document.hidden) setUnread(0);
        }}
      />
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
    </div>
  );
}
