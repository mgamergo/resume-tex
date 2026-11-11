"use client";
import { useSyncExternalStore } from "react";
export type ThemePreference = "system" | "light" | "dark";
const key = "resume-tex-theme";
const listeners = new Set<() => void>();
function preference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) stop?.();
  };
}
let stop: (() => void) | undefined;
function start() {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      document.documentElement.dataset.theme = preference(event.newValue);
      emit();
    }
  };
  media.addEventListener("change", emit);
  window.addEventListener("storage", storage);
  stop = () => {
    observer.disconnect();
    media.removeEventListener("change", emit);
    window.removeEventListener("storage", storage);
  };
}
function snapshot() {
  return (
    preference(document.documentElement.getAttribute("data-theme")) +
    ":" +
    getComputedStyle(document.documentElement)
      .getPropertyValue("--theme-dark")
      .trim()
  );
}
export function setTheme(value: ThemePreference) {
  document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem(key, value);
  } catch {}
  emit();
}
export function useTheme() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "system:0");
  const [choice, resolved] = value.split(":");
  return { preference: preference(choice), dark: resolved === "1", setTheme };
}
