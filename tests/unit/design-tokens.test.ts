import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync("src/styles/tokens.css", "utf8");
const globalCss = readFileSync("src/styles/global.css", "utf8");

function tokenHex(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing hexadecimal token --${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe("visual system accessibility", () => {
  it("keeps primary and muted text above the WCAG AA text threshold", () => {
    const background = tokenHex("color-bg");
    const surface = tokenHex("color-surface");

    expect(contrast(tokenHex("color-text"), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenHex("color-text-muted"), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenHex("color-text-muted"), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps non-text outlines above the WCAG 1.4.11 threshold", () => {
    expect(
      contrast(tokenHex("color-outline"), tokenHex("color-surface")),
    ).toBeGreaterThanOrEqual(3);
  });

  it("preserves reduced-motion and forced-colors accommodations", () => {
    expect(globalCss).toContain("prefers-reduced-motion: reduce");
    expect(globalCss).toContain("forced-colors: active");
  });
});
