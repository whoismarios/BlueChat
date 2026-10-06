"use client";

import { useSyncExternalStore } from "react";

export interface ThemeColors {
  isDark: boolean;
  surface: string;
  raised: string;
  sunken: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  accent: string;
  brand: string;
  danger: string;
}

const LIGHT: ThemeColors = {
  isDark: false,
  surface: "#fbfcfe",
  raised: "#ffffff",
  sunken: "#f1f5fa",
  ink: "#0b1a2b",
  muted: "#4a5a6e",
  faint: "#8796a8",
  line: "#dde5ef",
  lineStrong: "#c3d0df",
  accent: "#00a3e0",
  brand: "#0050a0",
  danger: "#c2372f",
};

let cache: ThemeColors | null = null;

function compute(): ThemeColors {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const cs = getComputedStyle(root);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    isDark,
    surface: v("--surface", LIGHT.surface),
    raised: v("--surface-raised", LIGHT.raised),
    sunken: v("--surface-sunken", LIGHT.sunken),
    ink: v("--ink", LIGHT.ink),
    muted: v("--ink-muted", LIGHT.muted),
    faint: v("--ink-faint", LIGHT.faint),
    line: v("--line", LIGHT.line),
    lineStrong: v("--line-strong", LIGHT.lineStrong),
    accent: v("--color-accent", LIGHT.accent),
    brand: isDark ? v("--color-brand-300", "#7fb6e6") : v("--color-brand-600", LIGHT.brand),
    danger: v("--danger", LIGHT.danger),
  };
}

function read(): ThemeColors {
  if (typeof document === "undefined") return LIGHT;
  // recompute when the theme flipped while nobody was subscribed
  if (!cache || cache.isDark !== document.documentElement.classList.contains("dark")) cache = compute();
  return cache;
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(() => {
    const next = compute();
    // Only publish a new object when a color actually changed (iframes rebuild on change).
    if (!cache || JSON.stringify(next) !== JSON.stringify(cache)) {
      cache = next;
      cb();
    }
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  return () => obs.disconnect();
}

/** Current theme colors (resolved CSS custom properties), re-read when `.dark` toggles on <html>. */
export function useThemeColors(): ThemeColors {
  return useSyncExternalStore(subscribe, read, () => LIGHT);
}
