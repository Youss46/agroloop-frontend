import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, adminRolesTable, isAdminRole, type Permissions } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "agroloopci-dev-secret";

export interface AuthPayload {
  userId: number;
  role: string;
  tv?: number;
  permissions?: Permissions;
  adminRoleName?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Verify a bare JWT and enforce the user's current tokenVersion.
 * Returns the payload on success, null if the token is invalid or has been revoked.
 * Use this from non-Express auth surfaces (Socket.IO handshake, ad-hoc helpers).
 */
export async function verifyJwtWithVersion(token: string): Promise<AuthPayload | null> {
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
  const [row] = await db
    .select({ tokenVersion: usersTable.tokenVersion })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  if (!row) return null;
  if ((payload.tv ?? 0) !== row.tokenVersion) return null;
  return payload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  const token = authHeader.slice(7);
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Token invalide" });
    return;
  }
  const [row] = await db
    .select({ tokenVersion: usersTable.tokenVersion })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  if (!row) { res.status(401).json({ error: "Compte introuvable" }); return; }
  if ((payload.tv ?? 0) !== row.tokenVersion) {
    res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    return;
  }
  req.auth = payload;
  // Best-effort, debounced last_seen update (max 1 write/min/user).
  touchLastSeenInline(payload.userId);
  next();
}

const _lastSeenWrites = new Map<number, number>();
function touchLastSeenInline(userId: number): void {
  const now = Date.now();
  const prev = _lastSeenWrites.get(userId) ?? 0;
  if (now - prev < 60_000) return;
  _lastSeenWrites.set(userId, now);
  db.execute(sql`UPDATE users SET last_seen = NOW() WHERE id = ${userId}`)
    .catch(() => { /* ignore */ });
}

async function loadAdminContext(userId: number) {
  const [row] = await db
    .select({
      role: usersTable.role,
      isBanned: usersTable.isBanned,
      isAdminActive: usersTable.isAdminActive,
      adminRoleId: usersTable.adminRoleId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!row) return null;
  let permissions: Permissions = {};
  let adminRoleName: string | undefined;
  if (row.adminRoleId) {
    const [ar] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.id, row.adminRoleId));
    if (ar) {
      permissions = ar.permissions ?? {};
      adminRoleName = ar.name;
    }
  }
  return { ...row, permissions, adminRoleName };
}

/** Any active admin sub-role. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Non autorisé" }); return; }
  const ctx = await loadAdminContext(req.auth.userId);
  if (!ctx) { res.status(401).json({ error: "Compte introuvable" }); return; }
  if (ctx.isBanned) { res.status(403).json({ error: "Compte suspendu" }); return; }
  if (!isAdminRole(ctx.role)) { res.status(403).json({ error: "Accès réservé aux administrateurs" }); return; }
  if (!ctx.isAdminActive) {
    res.status(403).json({ error: "Compte administrateur désactivé. Contactez le Super Administrateur." });
    return;
  }
  req.auth.role = ctx.role;
  req.auth.permissions = ctx.permissions;
  req.auth.adminRoleName = ctx.adminRoleName;
  next();
}

/** Granular permission gate. Run AFTER requireAuth + requireAdmin. */
export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const perms = req.auth?.permissions ?? {};
    const allowed = Array.isArray(perms[resource]) && perms[resource].includes(action);
    // Legacy 'admin' role keeps full access (backward compat for existing accounts not yet migrated).
    if (!allowed && req.auth?.role !== "admin") {
      res.status(403).json({
        error: "PERMISSION_DENIED",
        message: "Vous n'avez pas accès à cette fonctionnalité",
        required: { resource, action },
      });
      return;
    }
    next();
  };
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) { res.status(401).json({ error: "Non autorisé" }); return; }
    if (req.auth.role !== role) { res.status(403).json({ error: "Accès refusé" }); return; }
    next();
  };
}

/** Sugar: super_admin only (also allows legacy 'admin'). */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) { res.status(401).json({ error: "Non autorisé" }); return; }
  if (req.auth.role !== "super_admin" && req.auth.role !== "admin") {
    res.status(403).json({ error: "Réservé au Super Administrateur" });
    return;
  }
  next();
}
