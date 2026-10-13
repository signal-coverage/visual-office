export interface AuthStatus {
  /** Whether the keys needed to verify who somebody is are there and look right. */
  ready: boolean;
  /** What to print at startup. Never holds a key. */
  summary: string;
}

type Env = Record<string, string | undefined>;

const value = (env: Env, name: string): string | undefined => {
  const text = env[name]?.trim();
  return text ? text : undefined;
};

/** "test" or "live", from a Clerk key such as sk_test_… */
const kindOf = (key: string): string | undefined =>
  /^(?:sk|pk)_(test|live)_/.exec(key)?.[1];

/**
 * Whether sign-in (Clerk) is configured, from the environment. It only reads the
 * shape of the keys (secret or publishable, test or live), so it can say what
 * is wrong without ever printing one: they are secrets.
 */
export function authStatusFromEnv(env: Env): AuthStatus {
  const secret = value(env, "CLERK_SECRET_KEY");
  const publishableName = value(env, "VITE_CLERK_PUBLISHABLE_KEY")
    ? "VITE_CLERK_PUBLISHABLE_KEY"
    : "CLERK_PUBLISHABLE_KEY";
  const publishable = value(env, publishableName);

  if (!secret && !publishable)
    return {
      ready: false,
      summary:
        "Sign-in is off: set CLERK_SECRET_KEY and VITE_CLERK_PUBLISHABLE_KEY to turn it on",
    };
  const missing = [
    secret ? null : "CLERK_SECRET_KEY",
    publishable ? null : "VITE_CLERK_PUBLISHABLE_KEY",
  ].find(Boolean);
  if (missing)
    return { ready: false, summary: `Sign-in is off: missing ${missing}` };

  if (!secret!.startsWith("sk_"))
    return {
      ready: false,
      summary:
        "Sign-in is off: CLERK_SECRET_KEY should start with sk_ (is it the publishable key?)",
    };
  if (!publishable!.startsWith("pk_"))
    return {
      ready: false,
      summary: `Sign-in is off: ${publishableName} should start with pk_ (is it the secret key?)`,
    };

  const secretKind = kindOf(secret!);
  const publishableKind = kindOf(publishable!);
  if (secretKind !== publishableKind)
    return {
      ready: false,
      summary: `Sign-in is off: the secret key is ${secretKind ?? "unrecognised"} and the publishable key is ${publishableKind ?? "unrecognised"}; they must come from the same Clerk instance (test and live differ)`,
    };

  return {
    ready: true,
    summary: `Sign-in is ready (Clerk, ${secretKind} keys)`,
  };
}
