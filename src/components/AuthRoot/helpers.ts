/**
 * Whether the page should offer creating an account instead of signing in: the
 * link asks for it (`?mode=sign-up`), or it carries an invitation (`__clerk_ticket`),
 * which is what the link in an invitation email does, wherever it lands.
 */
export function wantsSignUp(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("mode") === "sign-up" || !!params.get("__clerk_ticket");
}
