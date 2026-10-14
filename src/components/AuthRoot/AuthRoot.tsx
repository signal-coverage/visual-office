import {
  ClerkLoading,
  ClerkProvider,
  Show,
  SignIn,
  SignUp,
  UserButton,
  useAuth,
} from "@clerk/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { FLOOR_ID } from "../../../shared/floors.ts";
import { AppEntry } from "../../App";
import { fetchAccess, type Access } from "../../editor/access";
import { gameBackend } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { AccountGate, type Member } from "../AccountGate";
import { ErrorBoundary } from "../ErrorBoundary";
import { GameEditor } from "../GameEditor";
import { LoadFailed } from "../LoadFailed";
import {
  CLERK_APPEARANCE,
  INVITE_ONLY_NOTE,
  LOADING_TEXT,
  PUBLISHABLE_KEY,
  SIGN_IN_SUBTITLE,
  SIGN_IN_TITLE,
  SIGN_UP_SUBTITLE,
} from "./consts";
import { wantsSignUp } from "./helpers";
import * as styles from "./styles";

// Own chunks: only the admins ever open these screens
const InvitePeople = lazy(() =>
  import("../InvitePeople").then((module) => ({
    default: module.InvitePeople,
  })),
);
const CompanySettings = lazy(() =>
  import("../CompanySettings").then((module) => ({
    default: module.CompanySettings,
  })),
);
const ActivityLog = lazy(() =>
  import("../ActivityLog").then((module) => ({ default: module.ActivityLog })),
);
const CalendarsAdmin = lazy(() =>
  import("../CalendarsAdmin").then((module) => ({
    default: module.CalendarsAdmin,
  })),
);
const PeopleAdmin = lazy(() =>
  import("../PeopleAdmin").then((module) => ({ default: module.PeopleAdmin })),
);

/**
 * The office, for somebody who is in the company: called what the server calls
 * them (their profile), with the editor offered if they may edit the floor, the
 * people screen if they are an admin, and the invitations if they are one too.
 */
function MemberApp({ member }: { member: Member }) {
  const { getToken, signOut } = useAuth();
  const [access, setAccess] = useState<Access>({
    canEdit: false,
    canManage: false,
  });
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [calendarsOpen, setCalendarsOpen] = useState(false);

  // Asked once for each person: it only decides which buttons to show
  const userId = member.user.id;
  useEffect(() => {
    let current = true;
    void fetchAccess(
      gameBackend({
        serverUrl: currentServerUrl(),
        floor: FLOOR_ID,
        getToken,
        models: [],
      }),
    ).then((found) => {
      if (current) setAccess(found);
    });
    return () => {
      current = false;
    };
  }, [userId, getToken]);

  return (
    <>
      <AppEntry
        signedIn={{
          displayName: member.user.name,
          canEditName: member.canEditName,
          getToken,
          appearance: member.appearance,
          signOut: () => void signOut(),
          accountMenu: <UserButton />,
          onEditFloor: access.canEdit ? () => setEditing(true) : undefined,
          onManagePeople: access.canManage
            ? () => setManaging(true)
            : undefined,
          onInvitePeople: member.user.isAdmin
            ? () => setInviting(true)
            : undefined,
          onOpenSettings: member.user.isAdmin
            ? () => setSettingsOpen(true)
            : undefined,
          onOpenActivity: member.user.isAdmin
            ? () => setActivityOpen(true)
            : undefined,
          onOpenCalendars: member.user.isAdmin
            ? () => setCalendarsOpen(true)
            : undefined,
        }}
      />
      {managing && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => setManaging(false)} />}
        >
          <Suspense fallback={null}>
            <PeopleAdmin
              getToken={getToken}
              onClose={() => setManaging(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {inviting && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => setInviting(false)} />}
        >
          <Suspense fallback={null}>
            <InvitePeople
              organizationId={member.organizationId}
              onClose={() => setInviting(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {settingsOpen && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => setSettingsOpen(false)} />}
        >
          <Suspense fallback={null}>
            <CompanySettings
              getToken={getToken}
              onClose={() => setSettingsOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {activityOpen && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => setActivityOpen(false)} />}
        >
          <Suspense fallback={null}>
            <ActivityLog
              getToken={getToken}
              onClose={() => setActivityOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {calendarsOpen && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => setCalendarsOpen(false)} />}
        >
          <Suspense fallback={null}>
            <CalendarsAdmin
              getToken={getToken}
              onClose={() => setCalendarsOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {editing && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => setEditing(false)} />}
        >
          <GameEditor getToken={getToken} onClose={() => setEditing(false)} />
        </ErrorBoundary>
      )}
    </>
  );
}

/**
 * Asks people to sign in when the sign-in service is configured (a publishable
 * key is set), and shows the office once they have. Without a key it shows the
 * office to everybody, as before.
 */
export function AuthRoot() {
  // Creating an account happens on this page too: from a link asking for it, or from an invitation
  const [signingUp] = useState(() => wantsSignUp(window.location.search));
  if (!PUBLISHABLE_KEY) return <AppEntry />;
  return (
    // Everything Clerk would redirect to stays on this page: its own pages would be a second login
    <ClerkProvider
      appearance={CLERK_APPEARANCE}
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/"
      signUpUrl="/?mode=sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ClerkLoading>
        <div className={styles.backdrop}>{LOADING_TEXT}</div>
      </ClerkLoading>
      <Show when="signed-out">
        <div className={styles.backdrop}>
          <h1 className={styles.title}>{SIGN_IN_TITLE}</h1>
          <p className={styles.subtitle}>
            {signingUp ? SIGN_UP_SUBTITLE : SIGN_IN_SUBTITLE}
          </p>
          {signingUp ? (
            <SignUp routing="hash" signInUrl="/" />
          ) : (
            <SignIn routing="hash" signUpUrl="/?mode=sign-up" />
          )}
          <p className={styles.note}>{INVITE_ONLY_NOTE}</p>
        </div>
      </Show>
      <Show when="signed-in">
        <AccountGate>{(member) => <MemberApp member={member} />}</AccountGate>
      </Show>
    </ClerkProvider>
  );
}
