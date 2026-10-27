"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "patchpilot-theme";
const listeners = new Set();
let cachedTheme = null;

function readTheme() {
  if (cachedTheme) return cachedTheme;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      cachedTheme = stored;
      return cachedTheme;
    }
    cachedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return cachedTheme;
  } catch {
    return "light";
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerTheme() {
  return "light";
}

function applyTheme(theme) {
  cachedTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private browsing; the theme still applies.
  }
  listeners.forEach((listener) => listener());
}

export function ThemeProvider({ children }) {
  return children;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerTheme);

  const setTheme = useCallback((next) => {
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(readTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, setTheme, toggleTheme };
}