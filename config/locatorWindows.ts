import type { ConfigAPI, PluginObj } from "@babel/core";
import locatorModule from "@locator/babel-jsx/dist/index.js";

type PluginFactory = (
  api: ConfigAPI,
  options: unknown,
  dirname: string,
) => PluginObj;
// The package is CommonJS compiled from TypeScript: the function lives on `.default`
const locator: PluginFactory =
  (locatorModule as unknown as { default?: PluginFactory }).default ??
  (locatorModule as unknown as PluginFactory);

const toForwardSlashes = (path: string) => path.replace(/\\/g, "/");

type State = { filename?: string; cwd?: string };
type Visitor = (this: unknown, path: unknown, state: State) => void;

/**
 * @locator/babel-jsx 0.5.1 breaks on Windows. It writes each file's path into the generated
 * code as a string without escaping it, so `C:\Users\...\visual-office` turns into
 * `C:Users...<vertical tab>isual-office` (and a path containing `\u` is a syntax error that
 * stops the dev server). The ids it puts on elements are escaped correctly, so they never match
 * the registry and Alt+click cannot find any source.
 *
 * Giving the plugin forward-slash paths avoids all of it, and `C:/Users/...` is also the form
 * VS Code documents for `vscode://file/` links. On other systems this changes nothing.
 * Remove this wrapper once the package is fixed upstream.
 */
export function locatorForWindows(
  options: Record<string, unknown>,
): [PluginFactory, Record<string, unknown>] {
  const factory: PluginFactory = (api, pluginOptions, dirname) => {
    const inner = locator(api, pluginOptions, dirname);

    // One adjusted copy of the state per file, so anything the plugin stores on it survives
    const adjusted = new WeakMap<object, State>();
    const withForwardSlashes = (state: State): State => {
      let copy = adjusted.get(state);
      if (!copy) {
        copy = Object.create(state, {
          filename: {
            value: state.filename && toForwardSlashes(state.filename),
          },
          cwd: { value: state.cwd && toForwardSlashes(state.cwd) },
        }) as State;
        adjusted.set(state, copy);
      }
      return copy;
    };

    const wrap = (visit: Visitor): Visitor =>
      function (path, state) {
        return visit.call(this, path, withForwardSlashes(state));
      };

    const visitor: Record<string, unknown> = {};
    for (const [name, handler] of Object.entries(inner.visitor ?? {})) {
      if (typeof handler === "function") {
        visitor[name] = wrap(handler as Visitor);
      } else if (handler) {
        const { enter, exit } = handler as { enter?: Visitor; exit?: Visitor };
        visitor[name] = {
          enter: enter && wrap(enter),
          exit: exit && wrap(exit),
        };
      }
    }
    return { ...inner, visitor: visitor as PluginObj["visitor"] };
  };
  return [factory, options];
}
