"use client";
import { useSyncExternalStore } from "react";

// Saved schemes for logged-out users, stored in this browser's localStorage.
const KEY = "ys:saved:v1";
type State = { slugs: string[]; lastRemoved: { slug: string; index: number; at: number } | null };

let state: State = { slugs: [], lastRemoved: null };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) state = { ...state, slugs: parsed.filter((s) => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s)) };
  } catch { /* storage unavailable: keep in memory */ }
}

function set(next: State) {
  state = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(state.slugs)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const savedStore = {
  subscribe(l: () => void) { load(); listeners.add(l); return () => listeners.delete(l); },
  get() { load(); return state; },
  save(slug: string) { if (!state.slugs.includes(slug)) set({ slugs: [...state.slugs, slug], lastRemoved: null }); },
  remove(slug: string) {
    const index = state.slugs.indexOf(slug);
    if (index >= 0) set({ slugs: state.slugs.filter((s) => s !== slug), lastRemoved: { slug, index, at: Date.now() } });
  },
  undo() {
    const r = state.lastRemoved;
    if (!r) return;
    const slugs = [...state.slugs];
    slugs.splice(Math.min(r.index, slugs.length), 0, r.slug);
    set({ slugs, lastRemoved: null });
  },
  dismiss() { if (state.lastRemoved) set({ ...state, lastRemoved: null }); },
};

const EMPTY: State = { slugs: [], lastRemoved: null };
export function useSaved() {
  return useSyncExternalStore(savedStore.subscribe, savedStore.get, () => EMPTY);
}
