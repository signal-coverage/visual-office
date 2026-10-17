import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Playwright runs the specs of e2e/, in a browser: `npm run test:e2e`
      exclude: [...configDefaults.exclude, "e2e/**"],
      // The databases of the store tests start in memory (WebAssembly): with many test files
      // running at once the first test of a file can take longer than the default 5 s
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
