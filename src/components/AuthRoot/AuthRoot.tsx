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
import { App } from "../../App";
import { fetchAccess, type Access } from "../../editor/access";
import { gameBackend } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { AccountGate, type Member } from "../AccountGate";
import { GameEditor } from "../GameEditor";
import {
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
      <App
        signedIn={{
          displayName: member.user.name,
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
        }}
      />
      {managing && (
        <Suspense fallback={null}>
          <PeopleAdmin getToken={getToken} onClose={() => setManaging(false)} />
        </Suspense>
      )}
      {inviting && (
        <Suspense fallback={null}>
          <InvitePeople
            organizationId={member.organizationId}
            onClose={() => setInviting(false)}
          />
        </Suspense>
      )}
      {editing && (
        <GameEditor getToken={getToken} onClose={() => setEditing(false)} />
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
  if (!PUBLISHABLE_KEY) return <App />;
  return (
    // Everything Clerk would redirect to stays on this page: its own pages would be a second login
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/"
      signUpUrl="/?mode=sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ClerkLoading>
        <div style={styles.backdrop}>{LOADING_TEXT}</div>
      </ClerkLoading>
      <Show when="signed-out">
        <div style={styles.backdrop}>
          <h1 style={styles.title}>{SIGN_IN_TITLE}</h1>
          <p style={styles.subtitle}>
            {signingUp ? SIGN_UP_SUBTITLE : SIGN_IN_SUBTITLE}
          </p>
          {signingUp ? (
            <SignUp routing="hash" signInUrl="/" />
          ) : (
            <SignIn routing="hash" signUpUrl="/?mode=sign-up" />
          )}
          <p style={styles.note}>{INVITE_ONLY_NOTE}</p>
        </div>
      </Show>
      <Show when="signed-in">
        <AccountGate>{(member) => <MemberApp member={member} />}</AccountGate>
      </Show>
    </ClerkProvider>
  );
}
