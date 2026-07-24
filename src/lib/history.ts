'use client'

/** Client-side recent-resolution history in localStorage. Never leaves the device. */

const KEY = 'clearway:history:v1'
const MAX = 20

export interface HistoryEntry {
  source: string
  destination: string
  resolvedAt: string
}

export function readHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const existing = readHistory().filter((e) => e.source !== entry.source)
  const next = [entry, ...existing].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked — history is best-effort */
  }
  return next
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
