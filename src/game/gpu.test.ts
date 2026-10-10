import { describe, expect, it } from "vitest";
import { isSoftwareRenderer } from "./gpu";

describe("isSoftwareRenderer", () => {
  it.each([
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
    "Mesa llvmpipe (LLVM 15.0.7, 256 bits)",
    "Microsoft Basic Render Driver",
    "Software Rasterizer",
  ])("flags %s as software rendering", (name) => {
    expect(isSoftwareRenderer(name)).toBe(true);
  });

  it.each([
    "ANGLE (AMD, AMD Radeon RX 6900 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)",
    "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    "Apple M2",
  ])("does not flag the hardware GPU %s", (name) => {
    expect(isSoftwareRenderer(name)).toBe(false);
  });

  it("does not guess when the GPU is unknown", () => {
    expect(isSoftwareRenderer("")).toBe(false);
    expect(isSoftwareRenderer(undefined)).toBe(false);
  });
});
