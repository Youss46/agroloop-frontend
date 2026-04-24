import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// Debounced last_seen updater. Only writes once per user per minute.
const lastWrite = new Map<number, number>();
const DEBOUNCE_MS = 60_000;

export function touchLastSeen(_req: Request, _res: Response, next: NextFunction): void {
  const userId = _req.auth?.userId;
  if (!userId) { next(); return; }
  const now = Date.now();
  const prev = lastWrite.get(userId) ?? 0;
  if (now - prev < DEBOUNCE_MS) { next(); return; }
  lastWrite.set(userId, now);
  // Best-effort fire-and-forget update.
  db.execute(sql`UPDATE users SET last_seen = NOW() WHERE id = ${userId}`)
    .catch(() => { /* ignore */ });
  next();
}
