import { useSyncExternalStore } from "react";

const PING_URL = "/api/ping";
const POLL_INTERVAL_MS = 25_000;
const REQUEST_TIMEOUT_MS = 5_000;

type Listener = () => void;

let currentOnline: boolean =
  typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<Listener>();
let started = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function setOnline(next: boolean) {
  if (next === currentOnline) return;
  currentOnline = next;
  emit();
}

async function checkConnectivity(): Promise<boolean> {
  if (typeof fetch === "undefined") return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${PING_URL}?t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function runCheck() {
  const ok = await checkConnectivity();
  setOnline(ok);
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", runCheck);
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("focus", runCheck);
  pollTimer = setInterval(runCheck, POLL_INTERVAL_MS);
  runCheck();
}

function subscribe(listener: Listener) {
  ensureStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentOnline;
}

function getServerSnapshot() {
  return true;
}

export function useOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
