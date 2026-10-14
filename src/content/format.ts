/** The time of day, as the person's browser writes it: "14:05". */
export function clockText(
  date: Date,
  locale?: string,
  timeZone?: string,
): string {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** When something was posted: "14 Oct", with the year when it is not this one. */
export function postedText(
  at: number,
  locale?: string,
  timeZone?: string,
  now: number = Date.now(),
): string {
  const date = new Date(at);
  const sameYear =
    date.toLocaleDateString("en-US", { year: "numeric", timeZone }) ===
    new Date(now).toLocaleDateString("en-US", { year: "numeric", timeZone });
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone,
  });
}

/** The site a link goes to, so the button says where it leads. */
export function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}
