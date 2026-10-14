import { useEffect, useRef, type PointerEvent } from "react";
import * as THREE from "three";
import type { Appearance } from "../../../shared/appearance.ts";
import { createAvatar, type Avatar } from "../../game/avatar";
import {
  PREVIEW_LABEL,
  PREVIEW_SIZES,
  PREVIEW_UNAVAILABLE,
  SPIN_SPEED,
} from "./consts";
import { dragYaw } from "./helpers";
import * as styles from "./styles";
import type { AvatarPreviewProps } from "./types";

/**
 * Draws the character the player is building, slowly turning around. Holding
 * the mouse down on it stops the turning and lets the player turn it by hand.
 */
export function AvatarPreview({
  name,
  appearance,
  size = "small",
}: AvatarPreviewProps) {
  const { width, height } = PREVIEW_SIZES[size];
  const containerRef = useRef<HTMLDivElement>(null);
  const showRef = useRef<((name: string, look: Appearance) => void) | null>(
    null,
  );
  const turnRef = useRef<((deltaX: number) => void) | null>(null);
  // The x of the pointer while the player holds the mouse down on the character
  const grabX = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A canvas of its own for each run of this effect: once a canvas has given
    // its WebGL context back (see the cleanup) it can never get another one.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    Object.assign(canvas.style, styles.canvas(width, height));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
    } catch (error) {
      // The preview is a nicety: without WebGL the rest of the menu still works
      console.warn("Character preview unavailable", error);
      container.textContent = PREVIEW_UNAVAILABLE;
      return;
    }
    container.replaceChildren(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a96, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-2, 4, -3);
    scene.add(key);

    // The avatar looks toward -z, so the camera stands on that side to see its face
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);
    camera.position.set(0, 1.35, -4.4);
    camera.lookAt(0, 1.2, 0);

    let avatar: Avatar | null = null;
    showRef.current = (label, look) => {
      if (avatar) {
        scene.remove(avatar.root);
        avatar.dispose();
      }
      const next = createAvatar(label, look);
      // Keep turning from where the last one was, so a change does not make it jump
      if (avatar) next.root.rotation.y = avatar.root.rotation.y;
      avatar = next;
      scene.add(next.root);
    };
    turnRef.current = (deltaX) => {
      if (avatar)
        avatar.root.rotation.y = dragYaw(avatar.root.rotation.y, deltaX);
    };

    let last = performance.now();
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (avatar) {
        // While it is held, it only turns with the hand
        if (grabX.current === null) avatar.root.rotation.y += SPIN_SPEED * dt;
        avatar.update(dt, 0);
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      showRef.current = null;
      turnRef.current = null;
      avatar?.dispose();
      renderer.dispose();
      // Browsers allow only a few WebGL contexts at once: give this one back now
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [width, height]);

  useEffect(() => {
    showRef.current?.(name, appearance);
  }, [name, appearance]);

  const grab = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    grabX.current = event.clientX;
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (grabX.current === null) return;
    turnRef.current?.(event.clientX - grabX.current);
    grabX.current = event.clientX;
  };
  const release = () => {
    grabX.current = null;
  };

  return (
    <div
      ref={containerRef}
      style={styles.container(width, height)}
      className={styles.draggable}
      role="img"
      aria-label={PREVIEW_LABEL}
      onPointerDown={grab}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
