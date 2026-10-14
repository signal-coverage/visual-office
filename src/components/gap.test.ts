import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL(".", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

function stylesFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesFiles(path);
    return entry.name === "styles.ts" ? [path] : [];
  });
}

/** Every string given as `export const name = "..."` (or on the next lines), with its name. */
function classStrings(source: string): { name: string; value: string }[] {
  const found: { name: string; value: string }[] = [];
  const pattern = /export const (\w+)\s*=\s*\n?\s*"([^"]*)"/g;
  for (const match of source.matchAll(pattern))
    found.push({ name: match[1], value: match[2] });
  return found;
}

describe("the class strings of the components", () => {
  it("never ask for a gap on something that is neither flex nor grid: the gap would do nothing", () => {
    const wrong: string[] = [];
    for (const file of stylesFiles(root))
      for (const { name, value } of classStrings(readFileSync(file, "utf8")))
        if (
          /(^|\s)gap(-[xy])?-/.test(value) &&
          !/(^|\s)(flex|inline-flex|grid|inline-grid)(\s|$)/.test(value)
        )
          wrong.push(`${file.slice(root.length)}: ${name} = "${value}"`);
    expect(wrong).toEqual([]);
  });
});
