/**
 * Headers every response carries. No Content-Security-Policy on purpose: the
 * server answers JSON only, and a policy meant for pages could break nothing
 * here but would give a false sense of cover; the site (Vercel) is where a CSP
 * would matter, and it must allow Clerk and LiveKit first.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function applySecurityHeaders(res: {
  setHeader: (name: string, value: string) => unknown;
}): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    res.setHeader(name, value);
}
