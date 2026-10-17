const MAX_VALUE_LENGTH = 200;
const MAX_ENTRIES = 20;
const SENSITIVE_KEY =
  /token|secret|password|authorization|cookie|email|body|dsn|key/i;

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@"']+@[^\s"')]*/gi, "[redacted-url]"],
  [/\bpostgres(?:ql)?:\/\/[^\s"')]*/gi, "[redacted-url]"],
  [/\bBearer\s+\S+/gi, "Bearer [redacted]"],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted-token]"],
  [/\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]+/g, "[redacted-key]"],
  [/\bsk_[A-Za-z0-9]{10,}/g, "[redacted-key]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[redacted-email]"],
  [/(https?:\/\/[^\s?#"']+)\?[^\s"']*/gi, "$1?[redacted]"],
  [/private-[0-9a-f]{16,}/gi, "private-[redacted]"],
];

/** The text with the parts that are secrets or about people taken out: addresses with passwords, tokens, keys, emails and query strings. */
export function redactText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of RULES)
    out = out.replace(pattern, replacement);
  return out;
}

/** Plain facts to send with an error report: short, redacted, and never anything named like a secret, a person or a request body. */
export function redactContext(
  context: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const kept: Record<string, string | number | boolean> = {};
  for (const [name, value] of Object.entries(context)) {
    if (Object.keys(kept).length >= MAX_ENTRIES) break;
    if (SENSITIVE_KEY.test(name)) continue;
    if (typeof value === "string")
      kept[name] = redactText(value).slice(0, MAX_VALUE_LENGTH);
    else if (typeof value === "number" || typeof value === "boolean")
      kept[name] = value;
  }
  return kept;
}
