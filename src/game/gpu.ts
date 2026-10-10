const SOFTWARE_RENDERERS =
  /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Whether the browser is drawing with the CPU instead of a graphics card.
 * That is the classic reason a 3D page crawls at ~10 fps, and it is usually
 * fixed by turning hardware acceleration on in the browser settings.
 */
export function isSoftwareRenderer(name: string | undefined): boolean {
  return name ? SOFTWARE_RENDERERS.test(name) : false;
}

/** The graphics card's name as WebGL reports it, or 'unknown' when the browser hides it. */
export function readGpuName(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): string {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info
    ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
    : "unknown";
}

/** Reads the GPU name from a throw-away context, before the game exists. */
export function detectGpuName(): string {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return "WebGL unavailable";
  const name = readGpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return name;
}
