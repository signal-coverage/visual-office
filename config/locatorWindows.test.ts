import path from "node:path";
import { runInNewContext } from "node:vm";
import { transformSync } from "@babel/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { locatorForWindows } from "./locatorWindows.ts";

// Absolute on every system (C:\work\visual-office on Windows, /work/visual-office elsewhere), so
// the same tests run on a developer's PC and on a Linux CI runner.
const PROJECT = path.resolve("/work/visual-office");

// The plugin only acts when NODE_ENV matches its `env` option, and tests run as "test"
beforeAll(() => vi.stubEnv("NODE_ENV", "development"));
afterAll(() => vi.unstubAllEnvs());

/**
 * Compiles a component the way the dev server does. `relativePath` is written with backslashes
 * on purpose: that is what a Windows checkout produces, and what the plugin used to mangle. On
 * Linux they are just odd characters in a file name, so the bug is reproduced there as well.
 */
function compile(relativePath: string) {
  const filename = `${PROJECT}/${relativePath}`;
  const output = transformSync("export const Hello = () => <div>hi</div>", {
    filename,
    cwd: PROJECT,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["jsx", "typescript"] },
    plugins: [locatorForWindows({ env: "development" })],
  });
  return output?.code ?? "";
}

/** Runs the generated code and returns what Locator would see in the browser. */
function runInBrowserLike(code: string) {
  const window: {
    __LOCATOR_DATA__?: Record<
      string,
      { filePath: string; projectPath: string }
    >;
  } = {};
  // JSX is already plain calls to `div(...)`-style output only after compiling; strip it for evaluation
  const registryOnly = code.slice(code.indexOf("(() => {"));
  runInNewContext(registryOnly, { window });
  return window.__LOCATOR_DATA__ ?? {};
}

describe("locatorForWindows", () => {
  it("compiles files whose Windows path would be an invalid JS escape (\\u...)", () => {
    // C:\...\src\App\utils.tsx contains "\u", which used to crash the dev server
    expect(() => compile("src\\App\\utils.tsx")).not.toThrow();
  });

  it("registers each file under a key that matches the ids put on its elements", () => {
    const code = compile("src\\App\\utils.tsx");
    const idPath =
      /data-locatorjs-id="([^"]*)::\d+"|data-locatorjs-id=\{"([^"]*)::\d+"\}/.exec(
        code,
      );
    const elementPath = idPath?.[1] ?? idPath?.[2];
    expect(elementPath, "the plugin marks the <div>").toBeTruthy();

    const registry = runInBrowserLike(code);
    expect(Object.keys(registry)).toEqual([elementPath]);
  });

  it("uses forward slashes, the form editors accept in vscode://file/ links", () => {
    const [key] = Object.keys(
      runInBrowserLike(compile("src\\components\\ChatPanel\\ChatPanel.tsx")),
    );
    expect(key).not.toContain("\\");
    expect(
      key.endsWith(
        "/work/visual-office/src/components/ChatPanel/ChatPanel.tsx",
      ),
    ).toBe(true);
  });

  it("keeps the project path and the file path separate, as the runtime expects", () => {
    const [entry] = Object.values(
      runInBrowserLike(compile("src\\App\\App.tsx")),
    );
    expect(entry.projectPath).not.toContain("\\");
    expect(entry.projectPath.endsWith("/work/visual-office")).toBe(true);
    expect(entry.filePath).toBe("/src/App/App.tsx");
  });
});
