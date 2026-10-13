import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvIfPresent } from "./loadEnv.ts";

const KEY = "VISUAL_OFFICE_TEST_VALUE";
const dirs: string[] = [];

function fileWith(text: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "office-env-"));
  dirs.push(dir);
  const file = path.join(dir, "settings.env");
  writeFileSync(file, text);
  return file;
}

afterEach(() => {
  delete process.env[KEY];
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

describe("loadEnvIfPresent", () => {
  it("puts what the file says into the environment", () => {
    loadEnvIfPresent(fileWith(`${KEY}='from the file'\n`));
    expect(process.env[KEY]).toBe("from the file");
  });

  it("does not override what the environment already has, so a host's settings win", () => {
    process.env[KEY] = "from the host";
    loadEnvIfPresent(fileWith(`${KEY}=from the file\n`));
    expect(process.env[KEY]).toBe("from the host");
  });

  it("does nothing when there is no file (production sets its variables itself)", () => {
    expect(() =>
      loadEnvIfPresent(path.join(tmpdir(), "office-env-missing", ".env")),
    ).not.toThrow();
  });
});
