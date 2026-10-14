import { lazy, Suspense, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadFailed } from "../components/LoadFailed";
import { LOAD_FAILED } from "../components/LoadFailed/consts";
import { chooseView, readDevice } from "../lite/device";
import { LITE_LOADING_TEXT } from "./consts";
import * as styles from "./styles";
import type { AppProps } from "./types";

// Their own chunks: the 3D office (with Three.js) is not downloaded by a device that gets the lite screen, and the other way round
const OfficeApp = lazy(() =>
  import("./App").then((module) => ({ default: module.App })),
);
const LiteOffice = lazy(() =>
  import("../components/LiteOffice").then((module) => ({
    default: module.LiteOffice,
  })),
);

/** The same address, asking for the 3D office even where it is not the first choice. */
function openOffice() {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "office");
  window.location.assign(url);
}

/**
 * The 3D office where the device can show it, the lite screen where it cannot.
 * The choice is made once, when the page loads, before anything asks for WebGL.
 */
export function AppEntry({ signedIn }: AppProps) {
  const [choice] = useState(() => {
    const device = readDevice();
    return { ...chooseView(device), webgl: device.webgl };
  });

  return (
    <ErrorBoundary
      fallback={
        <LoadFailed
          closeLabel={LOAD_FAILED.reload}
          onClose={() => window.location.reload()}
        />
      }
    >
      <Suspense
        fallback={<div className={styles.loading}>{LITE_LOADING_TEXT}</div>}
      >
        {choice.view === "office" ? (
          <OfficeApp signedIn={signedIn} />
        ) : (
          <LiteOffice
            reason={choice.reason}
            signedIn={signedIn}
            onTryOffice={choice.webgl ? openOffice : undefined}
          />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}
