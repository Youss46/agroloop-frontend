import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import bcryptjs from "bcryptjs";
import { eq, desc, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  adminRolesTable,
  isAdminRole,
  ADMIN_ROLES,
  type Permissions,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEV_TOKEN = process.env.DEV_PORTAL_TOKEN;
const VALID_DEV_ROLES = new Set(["super_admin", "admin", "moderateur", "support", "finance", "commercial"]);

// Constant-time compare with built-in crypto. Both buffers are padded/truncated
// to the same length so the underlying timingSafeEqual call never short-circuits
// on length mismatch (a separate XOR over the lengths captures that signal).
function safeTokenEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  const len = Math.max(a.length, b.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  a.copy(padA);
  b.copy(padB);
  const eq = timingSafeEqual(padA, padB);
  return eq && a.length === b.length;
}

function requireDevToken(req: Request, res: Response, next: NextFunction): void {
  if (!DEV_TOKEN) {
    res.status(503).json({ error: "Espace développeur non configuré (DEV_PORTAL_TOKEN absent)" });
    return;
  }
  const provided = req.header("x-dev-token") ?? "";
  if (!provided || !safeTokenEqual(provided, DEV_TOKEN)) {
    res.status(401).json({ error: "Jeton développeur invalide" });
    return;
  }
  next();
}

// Permissions complètes pour super_admin / admin (toutes ressources, toutes actions).
const FULL_PERMISSIONS: Permissions = {
  users: ["view", "edit", "delete", "ban", "verify"],
  admin_accounts: ["view", "create", "edit", "delete"],
  offres: ["view", "edit", "delete", "moderate"],
  transactions: ["view", "edit", "refund"],
  contracts: ["view", "edit", "delete"],
  subscriptions: ["view", "edit"],
  plans: ["view", "edit"],
  payment_settings: ["view", "edit"],
  payments: ["view", "edit"],
  notifications: ["view", "send"],
  support: ["view", "respond", "close"],
  support_tickets: ["view", "reply", "assign", "delete", "configure", "stats", "reopen", "merge", "mark_spam"],
  reports: ["view", "export"],
  settings: ["view", "edit"],
};

const ROLE_DEFAULTS: Record<string, { label: string; description: string; permissions: Permissions }> = {
  super_admin: { label: "Super Administrateur", description: "Accès complet à la plateforme", permissions: FULL_PERMISSIONS },
  admin: { label: "Administrateur", description: "Accès complet (legacy)", permissions: FULL_PERMISSIONS },
  moderateur: { label: "Modérateur", description: "Modération du contenu et des comptes", permissions: { users: ["view", "ban"], offres: ["view", "moderate"], support: ["view", "respond"] } },
  support: { label: "Support", description: "Gestion des tickets de support", permissions: { users: ["view"], support: ["view", "respond", "close"], support_tickets: ["view", "reply", "assign", "stats", "reopen", "merge", "mark_spam"] } },
  finance: { label: "Finance", description: "Gestion financière", permissions: { transactions: ["view", "refund"], subscriptions: ["view", "edit"], plans: ["view", "edit"], payment_settings: ["view", "edit"], payments: ["view", "edit"], reports: ["view", "export"] } },
  commercial: { label: "Commercial", description: "Suivi commercial", permissions: { users: ["view"], reports: ["view"] } },
};

async function ensureAdminRole(roleName: string): Promise<number> {
  const [existing] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.name, roleName));
  if (existing) return existing.id;
  const def = ROLE_DEFAULTS[roleName];
  if (!def) throw new Error(`Rôle inconnu: ${roleName}`);
  const [created] = await db
    .insert(adminRolesTable)
    .values({ name: roleName, label: def.label, description: def.description, permissions: def.permissions })
    .returning();
  logger.info({ roleName, roleId: created.id }, "Auto-seeded admin role from dev portal");
  return created.id;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function serializeAdmin(u: any, roleLabel: string | null) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    role_label: roleLabel,
    is_admin_active: u.isAdminActive,
    is_banned: u.isBanned,
    last_login: u.lastLogin ? u.lastLogin.toISOString() : null,
    created_at: u.createdAt.toISOString(),
    force_password_change: u.forcePasswordChange,
  };
}

// POST /api/dev/auth — vérifie simplement le jeton (pour l'écran d'accueil)
router.post("/dev/auth", requireDevToken, (_req, res): void => {
  res.json({ ok: true });
});

// GET /api/dev/admins — liste tous les admins
router.get("/dev/admins", requireDevToken, async (_req, res): Promise<void> => {
  const adminRoleValues = ADMIN_ROLES as readonly string[];
  const rows = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.role, adminRoleValues as any))
    .orderBy(desc(usersTable.createdAt));

  const allRoles = await db.select().from(adminRolesTable);
  const roleById = new Map(allRoles.map((r) => [r.id, r.label]));

  res.json({
    admins: rows.map((u) =>
      serializeAdmin(u, u.adminRoleId ? roleById.get(u.adminRoleId) ?? null : null),
    ),
  });
});

// POST /api/dev/admins — crée un nouveau compte admin
router.post("/dev/admins", requireDevToken, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const role = typeof b.role === "string" ? b.role : "super_admin";

  if (!name || name.length < 2) { res.status(400).json({ error: "Nom invalide (min. 2 caractères)" }); return; }
  if (!isValidEmail(email)) { res.status(400).json({ error: "Email invalide" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Mot de passe trop court (min. 8 caractères)" }); return; }
  if (!VALID_DEV_ROLES.has(role)) { res.status(400).json({ error: "Rôle invalide" }); return; }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) { res.status(409).json({ error: "Un compte avec cet email existe déjà" }); return; }

  const adminRoleId = await ensureAdminRole(role);
  const passwordHash = await bcryptjs.hash(password, 10);

  let created;
  try {
    [created] = await db
      .insert(usersTable)
      .values({
        name,
        email,
        passwordHash,
        role: role as any,
        adminRoleId,
        isAdminActive: true,
        forcePasswordChange: false,
      } as any)
      .returning();
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Un compte avec cet email existe déjà" });
      return;
    }
    throw e;
  }

  logger.warn({ adminId: created.id, email: created.email, role }, "Admin account created via dev portal");
  res.status(201).json(serializeAdmin(created, ROLE_DEFAULTS[role]?.label ?? role));
});

// PUT /api/dev/admins/:id — mise à jour du nom / email / rôle
router.put("/dev/admins/:id", requireDevToken, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }

  const b = req.body as Record<string, unknown>;
  const patch: Record<string, any> = {};
  if (typeof b.name === "string") {
    const name = b.name.trim();
    if (name.length < 2) { res.status(400).json({ error: "Nom invalide" }); return; }
    patch.name = name;
  }
  if (typeof b.email === "string") {
    const email = b.email.trim().toLowerCase();
    if (!isValidEmail(email)) { res.status(400).json({ error: "Email invalide" }); return; }
    if (email !== target.email) {
      const [conflict] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
      if (conflict) { res.status(409).json({ error: "Email déjà utilisé" }); return; }
    }
    patch.email = email;
  }
  if (typeof b.role === "string" && b.role !== target.role) {
    if (!VALID_DEV_ROLES.has(b.role)) { res.status(400).json({ error: "Rôle invalide" }); return; }
    const newRoleId = await ensureAdminRole(b.role);
    patch.role = b.role;
    patch.adminRoleId = newRoleId;
    // Force re-login for security on role change.
    patch.tokenVersion = sql`${usersTable.tokenVersion} + 1`;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Aucune modification" });
    return;
  }

  const [updated] = await db.update(usersTable).set(patch).where(eq(usersTable.id, id)).returning();
  const allRoles = await db.select().from(adminRolesTable);
  const roleLabel = updated.adminRoleId ? allRoles.find((r) => r.id === updated.adminRoleId)?.label ?? null : null;
  res.json(serializeAdmin(updated, roleLabel));
});

// PUT /api/dev/admins/:id/password — réinitialiser le mot de passe
router.put("/dev/admins/:id/password", requireDevToken, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) { res.status(400).json({ error: "Mot de passe trop court (min. 8 caractères)" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }

  const passwordHash = await bcryptjs.hash(password, 10);
  await db
    .update(usersTable)
    .set({
      passwordHash,
      forcePasswordChange: false,
      tokenVersion: sql`${usersTable.tokenVersion} + 1`,
    })
    .where(eq(usersTable.id, id));

  logger.warn({ adminId: id }, "Admin password reset via dev portal");
  res.json({ ok: true });
});

// PUT /api/dev/admins/:id/active — suspendre / réactiver
router.put("/dev/admins/:id/active", requireDevToken, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  if (typeof req.body?.active !== "boolean") {
    res.status(400).json({ error: "Le champ 'active' doit être un booléen" });
    return;
  }
  const active: boolean = req.body.active;

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }

  await db
    .update(usersTable)
    .set({
      isAdminActive: active,
      // Suspension révoque les sessions actives.
      ...(active ? {} : { tokenVersion: sql`${usersTable.tokenVersion} + 1` }),
    })
    .where(eq(usersTable.id, id));

  logger.warn({ adminId: id, active }, "Admin active status changed via dev portal");
  res.json({ ok: true, is_admin_active: active });
});

// DELETE /api/dev/admins/:id — suppression définitive
router.delete("/dev/admins/:id", requireDevToken, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  logger.warn({ adminId: id, email: target.email }, "Admin deleted via dev portal");
  res.json({ ok: true });
});

export default router;
