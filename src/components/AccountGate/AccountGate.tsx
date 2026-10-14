import {
  OrganizationList,
  UserButton,
  useAuth,
  useOrganization,
  useUser,
} from "@clerk/react";
import { Alert, Button, Card } from "@heroui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FLOOR_ID } from "../../../shared/floors.ts";
import {
  fetchSession,
  registerCompany,
  type Session,
} from "../../account/account";
import { gameBackend, httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { FAILED, INVITATION, LOADING, NOT_READY, SET_UP } from "./consts";
import * as styles from "./styles";
import type { AccountGateProps } from "./types";

type Request = (url: string, init?: RequestInit) => Promise<Response>;

/** A card in the middle of the screen, with the account menu to sign out. */
function GateCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.backdrop}>
      <Card className={styles.card}>
        <div className={styles.menu}>
          <UserButton />
        </div>
        <Card.Header>
          <Card.Title className={styles.title}>{title}</Card.Title>
        </Card.Header>
        <Card.Content className="gap-4">{children}</Card.Content>
      </Card>
    </div>
  );
}

function Retry({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button onPress={onClick}>{label}</Button>;
}

/** For the first admin: create the company's organization here, and tell the server it is the company. */
function SetUpCompany({
  request,
  serverUrl,
  onDone,
}: {
  request: Request;
  serverUrl: string;
  onDone: () => void;
}) {
  const { organization } = useOrganization();
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const saving = useRef(false);

  // As soon as there is an organization (just created, or picked), it is the company
  useEffect(() => {
    if (!organization || saving.current) return;
    saving.current = true;
    void registerCompany(request, serverUrl, organization.id).then((ok) => {
      saving.current = false;
      if (ok) onDone();
      else setFailed(true);
    });
  }, [organization, request, serverUrl, onDone, tries]);

  return (
    <GateCard title={SET_UP.title}>
      <p className={styles.text}>{SET_UP.body}</p>
      {failed ? (
        <>
          <Alert status="danger" className={styles.alert}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{SET_UP.failed}</Alert.Description>
            </Alert.Content>
          </Alert>
          <Retry
            label={SET_UP.retry}
            onClick={() => {
              setFailed(false);
              setTries((n) => n + 1);
            }}
          />
        </>
      ) : organization ? (
        <p className={styles.text}>{SET_UP.saving}</p>
      ) : (
        <div className={styles.centered}>
          <OrganizationList hidePersonal />
        </div>
      )}
    </GateCard>
  );
}

/**
 * Between signing in and the office: finds out from the game server whether the
 * person is in the company. If so they get the office; if not, they are told to
 * wait for an invitation; and the first admin can create the company here. One
 * sign-in does it all: nothing sends them to another page.
 */
export function AccountGate({ children }: AccountGateProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [{ request, serverUrl }] = useState(() => ({
    request: gameBackend({
      serverUrl: currentServerUrl(),
      floor: FLOOR_ID,
      getToken,
      models: [],
    }).request,
    serverUrl: httpUrlOf(currentServerUrl()),
  }));
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let current = true;
    void fetchSession(request, serverUrl).then((found) => {
      if (current) setSession(found);
    });
    return () => {
      current = false;
    };
  }, [request, serverUrl, attempt]);

  const checkAgain = () => {
    setSession(null);
    setAttempt((n) => n + 1);
  };

  if (!session)
    return (
      <div className={styles.backdrop}>
        <p>{LOADING}</p>
      </div>
    );

  if (session.state === "member")
    return children({
      organizationId: session.organizationId,
      appearance: session.appearance,
      canEditName: session.canEditName,
      user: session.user,
    });

  if (session.state === "not_member")
    return (
      <GateCard title={INVITATION.title}>
        <p className={styles.text}>{INVITATION.body}</p>
        {user?.primaryEmailAddress && (
          <p className={styles.who}>
            {INVITATION.signedInAs} {user.primaryEmailAddress.emailAddress}
          </p>
        )}
        <Retry label={INVITATION.retry} onClick={checkAgain} />
      </GateCard>
    );

  if (session.state === "company_missing")
    return session.canSetUp ? (
      <SetUpCompany
        request={request}
        serverUrl={serverUrl}
        onDone={checkAgain}
      />
    ) : (
      <GateCard title={NOT_READY.title}>
        <p className={styles.text}>{NOT_READY.body}</p>
        <Retry label={NOT_READY.retry} onClick={checkAgain} />
      </GateCard>
    );

  return (
    <GateCard title={FAILED.title}>
      <p className={styles.text}>
        {session.signedOut ? FAILED.signedOut : FAILED.body}
      </p>
      {!session.signedOut && (
        <Retry label={FAILED.retry} onClick={checkAgain} />
      )}
    </GateCard>
  );
}
