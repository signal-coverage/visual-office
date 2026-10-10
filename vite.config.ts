import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";
import { locatorForWindows } from "./config/locatorWindows.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
      plugins: [
        // other Babel plugins
        // Same plugin as before, with Windows paths fixed (see config/locatorWindows.ts)
        locatorForWindows({ env: "development" }),
      ],
    }),
  ],
  build: {
    // Three.js alone is ~700 kB minified and is needed from the first frame, so
    // the default 500 kB warning is not actionable. Voice (livekit-client) is
    // already lazy-loaded; this limit just sits above Three.js.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Own chunk: it rarely changes, so browsers keep it cached across app updates
        codeSplitting: {
          // `examples` (GLTFLoader) stays out: it is only needed once there are models to load
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/](?!examples)/ },
          ],
        },
      },
    },
  },
});
