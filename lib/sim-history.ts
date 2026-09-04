"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ConversationRow } from "@/lib/mock-data";

const KEY = "afriklang-sim-calls";
const EVENT = "afriklang-sim-history";
const EMPTY = "[]";

export function saveSimCall(row: ConversationRow) {
  try {
    const prev = JSON.parse(sessionStorage.getItem(KEY) ?? EMPTY) as ConversationRow[];
    sessionStorage.setItem(KEY, JSON.stringify([row, ...prev].slice(0, 25)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable — skip persistence
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  try {
    return sessionStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useSimCalls(): ConversationRow[] {
  const json = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return useMemo(() => {
    try {
      return JSON.parse(json) as ConversationRow[];
    } catch {
      return [];
    }
  }, [json]);
}
