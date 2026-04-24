import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { db, pageViewsTable } from "@workspace/db";

const SESSION_COOKIE = "agro_sid";
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile/i.test(ua)) return "mobile";
  return "desktop";
}

function getOrCreateSession(req: Request, res: Response): string {
  const existing = req.cookies?.[SESSION_COOKIE];
  if (existing && typeof existing === "string") {
    res.cookie(SESSION_COOKIE, existing, {
      maxAge: SESSION_MAX_AGE_MS,
      httpOnly: true,
      sameSite: "lax",
    });
    return existing;
  }
  const id = randomUUID();
  res.cookie(SESSION_COOKIE, id, {
    maxAge: SESSION_MAX_AGE_MS,
    httpOnly: true,
    sameSite: "lax",
  });
  return id;
}

export function analyticsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only track GET requests to API routes to avoid duplicate tracking
  if (req.method !== "GET") {
    next();
    return;
  }

  const sessionId = getOrCreateSession(req, res);
  const ua = req.headers["user-agent"] ?? "";
  const deviceType = detectDevice(ua);
  const path = req.path;
  const referrer = req.headers.referer ?? null;
  const userId = req.auth?.userId ?? null;

  // Fire-and-forget — never block the request
  db.insert(pageViewsTable).values({
    path,
    referrer: referrer ?? undefined,
    userId: userId ?? undefined,
    sessionId,
    deviceType,
  }).catch(() => { /* ignore */ });

  // Expose session id downstream for specific tracking
  (req as any).analyticsSessionId = sessionId;

  next();
}

export function getSessionId(req: Request): string {
  return (req as any).analyticsSessionId ?? randomUUID();
}
