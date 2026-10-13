import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { readdirSync } from "node:fs";
import { defineConfig } from "vite";
import { locatorForWindows } from "./config/locatorWindows.ts";
import { officeEditor } from "./config/officeEditorPlugin.ts";
import { isModelFileName } from "./shared/props.ts";
import { loadEnvIfPresent } from "./server/loadEnv.ts";

// The editor's development endpoints (config/officeEditorPlugin.ts) read FLOOR_ADMIN_TOKEN and
// GAME_SERVER_URL from the environment, like the game server does: Vite only reads VITE_ ones by itself
loadEnvIfPresent(".env.local");
loadEnvIfPresent(".env");

/** The models that come with this build: what the editor inside the game offers to place. */
const modelFiles = readdirSync("public/models").filter(isModelFileName).sort();

// https://vite.dev/config/
export default defineConfig({
  define: { __MODEL_FILES__: JSON.stringify(modelFiles) },
  plugins: [
    // The office editor (editor.html) and its save endpoint: development only
    officeEditor(),
    tailwindcss(),
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
