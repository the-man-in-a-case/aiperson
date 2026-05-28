import type { BoundaryConfig } from "@aiperson/shared";

export interface LiveSession {
  id: string;
  boundary: BoundaryConfig;
  voice?: string;
  history: { role: "user" | "assistant"; content: string }[];
  createdAt: number;
}

const sessions = new Map<string, LiveSession>();

export function putSession(s: LiveSession): void {
  sessions.set(s.id, s);
}

export function getSession(id: string): LiveSession | undefined {
  return sessions.get(id);
}

export function dropSession(id: string): void {
  sessions.delete(id);
}

// GC sessions older than 2h
setInterval(
  () => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, s] of sessions) if (s.createdAt < cutoff) sessions.delete(id);
  },
  10 * 60 * 1000,
).unref();
