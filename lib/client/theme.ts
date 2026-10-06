"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export { THEME_STORAGE_KEY, themeInitScript } from "./theme-script";
import { THEME_STORAGE_KEY } from "./theme-script";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<(p: ThemePreference) => void>();

/** Theme preference hook, synchronised across all consumers and with the OS when "system". */
export function useTheme() {
  const [preference, setPref] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = (p: ThemePreference) => {
      setPref(p);
      setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    sync(readPreference());
    listeners.add(sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => {
      if (readPreference() === "system") {
        apply("system");
        listeners.forEach((l) => l("system"));
      }
    };
    mq.addEventListener("change", onMq);
    return () => {
      listeners.delete(sync);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    // Avoid every element transitioning colours during the switch.
    const root = document.documentElement;
    root.classList.add("[&_*]:!transition-none");
    apply(p);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("[&_*]:!transition-none")));
    listeners.forEach((l) => l(p));
  }, []);

  const toggle = useCallback(() => {
    setPreference(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setPreference]);

  return { preference, resolved, setPreference, toggle };
}
