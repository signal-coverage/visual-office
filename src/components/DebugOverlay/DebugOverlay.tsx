import { useEffect, useState } from "react";
import type { Diagnostics } from "../../game/Game";
import { Row } from "./components/Row";
import {
  HITCH_MS,
  REFRESH_MS,
  SLOW_FPS,
  SOFTWARE_WARNING,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { DebugOverlayProps } from "./types";

/** Live numbers for answering "why does it feel slow?" with data instead of a guess. */
export function DebugOverlay({ read }: DebugOverlayProps) {
  const [stats, setStats] = useState<Diagnostics | null>(null);

  useEffect(() => {
    const refresh = () => setStats(read());
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [read]);

  if (!stats) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.title}>{TITLE}</div>
      <Row
        label="FPS"
        value={stats.fps.toFixed(0)}
        bad={stats.fps > 0 && stats.fps < SLOW_FPS}
      />
      <Row
        label="Worst frame"
        value={`${stats.worstFrameMs.toFixed(0)} ms`}
        bad={stats.worstFrameMs > HITCH_MS}
      />
      <Row
        label="Server corrections"
        value={String(stats.corrections)}
        bad={stats.corrections > 0}
      />
      <Row
        label="Resolution"
        value={`${stats.width}×${stats.height} @${stats.pixelRatio}x`}
      />
      <Row
        label="Draw calls"
        value={`${stats.drawCalls} · ${stats.triangles} tris`}
      />
      <Row label="Quality" value={stats.quality} />
      <Row label="GPU" value={stats.gpu} />
      {stats.softwareRendering && (
        <div style={styles.warning}>{SOFTWARE_WARNING}</div>
      )}
    </div>
  );
}
