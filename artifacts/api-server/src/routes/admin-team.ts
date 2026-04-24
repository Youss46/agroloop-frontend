import { Router, type IRouter } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, desc, and, ne, or, ilike, inArray, sql } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
import {
  db,
  usersTable,
  adminRolesTable,
  adminLogsTable,
  notificationsTable,
  isAdminRole,
  ADMIN_ROLES,
} from "@workspace/db";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";
import { adminInviteLimiter } from "../middlewares/rate-limit";

const router: IRouter = Router();

router.use("/admin/team", requireAuth, requireAdmin);

const ROLE_NAMES = new Set(["super_admin", "moderateur", "support", "finance", "commercial"]);

const FULL_PERMISSIONS = {
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
  ratings: ["view", "delete"],
  broadcast: ["send"],
  audit_logs: ["view"],
  verifications: ["view", "approve", "reject"],
} as const;

const STANDARD_ROLE_DEFS: Record<string, { label: string; description: string; permissions: any }> = {
  super_admin: { label: "Super Administrateur", description: "Accès complet à la plateforme", permissions: FULL_PERMISSIONS },
  moderateur: { label: "Modérateur", description: "Modération du contenu et des comptes", permissions: { users: ["view", "ban"], offres: ["view", "moderate"], support: ["view", "respond"] } },
  support: { label: "Support", description: "Gestion des tickets de support", permissions: { users: ["view"], support: ["view", "respond", "close"], support_tickets: ["view", "reply", "assign", "stats", "reopen"] } },
  finance: { label: "Finance", description: "Gestion financière", permissions: { transactions: ["view", "refund"], subscriptions: ["view", "edit"], plans: ["view", "edit"], payment_settings: ["view", "edit"], payments: ["view", "edit"], reports: ["view", "export"] } },
  commercial: { label: "Commercial", description: "Suivi commercial", permissions: { users: ["view"], reports: ["view"] } },
};

async function ensureStandardRoles(): Promise<void> {
  const existing = await db.select({ name: adminRolesTable.name }).from(adminRolesTable);
  const have = new Set(existing.map((r) => r.name));
  const toCreate = Object.entries(STANDARD_ROLE_DEFS)
    .filter(([name]) => !have.has(name))
    .map(([name, def]) => ({ name, label: def.label, description: def.description, permissions: def.permissions }));
  if (toCreate.length > 0) {
    await db.insert(adminRolesTable).values(toCreate as any);
  }
  // Always keep super_admin's permission set in sync with FULL_PERMISSIONS so
  // newly added resources (e.g. `plans`) become available without manual DB edits.
  await db
    .update(adminRolesTable)
    .set({ permissions: FULL_PERMISSIONS as any })
    .where(eq(adminRolesTable.name, "super_admin"));
}

async function loadAdminRoles() {
  await ensureStandardRoles();
  return db.select().from(adminRolesTable);
}

router.get("/admin/team", requirePermission("admin_accounts", "view"), async (req, res): Promise<void> => {
  const roles = await loadAdminRoles();
  const byId = new Map(roles.map((r) => [r.id, r]));

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const roleFilter = typeof req.query.role === "string" && ROLE_NAMES.has(req.query.role) ? req.query.role : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 20));

  const adminRoleValues = ADMIN_ROLES as readonly string[];
  const conds: any[] = [inArray(usersTable.role, adminRoleValues as any)];
  if (q) {
    conds.push(or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`)));
  }
  if (roleFilter) {
    conds.push(eq(usersTable.role, roleFilter as any));
  }
  if (statusFilter === "active") conds.push(eq(usersTable.isAdminActive, true));
  if (statusFilter === "inactive") conds.push(eq(usersTable.isAdminActive, false));
  const where = and(...conds);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(where);

  const admins = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      adminRoleId: usersTable.adminRoleId,
      createdByAdminId: usersTable.createdByAdminId,
      isAdminActive: usersTable.isAdminActive,
      lastLogin: usersTable.lastLogin,
      createdAt: usersTable.createdAt,
      avatarUrl: usersTable.avatarUrl,
      forcePasswordChange: usersTable.forcePasswordChange,
    })
    .from(usersTable)
    .where(where)
    .orderBy(desc(usersTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const creatorIds = Array.from(new Set(admins.map((a) => a.createdByAdminId).filter((x): x is number => !!x)));
  const creatorMap = new Map<number, string>();
  if (creatorIds.length) {
    const creators = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, creatorIds));
    for (const c of creators) creatorMap.set(c.id, c.name);
  }

  res.json({
    page,
    pageSize,
    total: Number(total),
    admins: admins.map((a) => {
      const ar = a.adminRoleId ? byId.get(a.adminRoleId) : null;
      return {
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        avatar_url: a.avatarUrl,
        admin_role: ar ? { name: ar.name, label: ar.label, description: ar.description } : null,
        is_admin_active: a.isAdminActive,
        last_login: a.lastLogin ? a.lastLogin.toISOString() : null,
        created_at: a.createdAt.toISOString(),
        created_by_id: a.createdByAdminId,
        created_by_name: a.createdByAdminId ? creatorMap.get(a.createdByAdminId) ?? null : null,
        force_password_change: a.forcePasswordChange,
      };
    }),
  });
});

router.get("/admin/team/roles", requirePermission("admin_accounts", "view"), async (_req, res): Promise<void> => {
  const roles = await loadAdminRoles();
  res.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      permissions: r.permissions,
    })),
  );
});

router.post("/admin/team/invite", adminInviteLimiter, requirePermission("admin_accounts", "create"), async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const role = typeof b.role === "string" ? b.role : "";

  if (!name || name.length < 2) { res.status(400).json({ error: "Nom invalide (min. 2 caractères)" }); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "Email invalide" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" }); return; }
  if (!ROLE_NAMES.has(role)) { res.status(400).json({ error: "Rôle invalide" }); return; }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) { res.status(409).json({ error: "Un compte avec cet email existe déjà" }); return; }

  const [adminRole] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.name, role));
  if (!adminRole) { res.status(400).json({ error: "Rôle introuvable" }); return; }

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
        adminRoleId: adminRole.id,
        createdByAdminId: req.auth!.userId,
        isAdminActive: true,
        forcePasswordChange: true,
      } as any)
      .returning();
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Un compte avec cet email existe déjà" });
      return;
    }
    throw e;
  }

  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: "create_admin",
    targetType: "user",
    targetId: created.id,
    details: { email, role, name },
  });

  // Welcome notification (in-app)
  await db.insert(notificationsTable).values({
    title: "Bienvenue dans l'équipe AgroLoopCI",
    message: `Votre compte ${adminRole.label} a été créé. Connectez-vous avec votre email et changez votre mot de passe à la première connexion.`,
    audience: "all",
    audienceValue: String(created.id),
    sentBy: req.auth!.userId,
    reach: 1,
  });

  res.status(201).json({
    id: created.id,
    name: created.name,
    email: created.email,
    role: created.role,
    admin_role: { name: adminRole.name, label: adminRole.label },
  });
});

router.put("/admin/team/:id/role", requirePermission("admin_accounts", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const role = typeof req.body?.role === "string" ? req.body.role : "";
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  if (!ROLE_NAMES.has(role)) { res.status(400).json({ error: "Rôle invalide" }); return; }
  if (id === req.auth!.userId) { res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre rôle" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }

  const [newRole] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.name, role));
  if (!newRole) { res.status(400).json({ error: "Rôle introuvable" }); return; }

  const oldRole = target.role;
  await db.update(usersTable)
    .set({ role: role as any, adminRoleId: newRole.id })
    .where(eq(usersTable.id, id));

  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: "change_admin_role",
    targetType: "user",
    targetId: id,
    details: { old_role: oldRole, new_role: role },
  });

  res.json({ success: true, new_role: role });
});

async function setAdminActive(req: any, res: any, active: boolean) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  if (id === req.auth!.userId) { res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre statut" }); return; }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }
  await db.update(usersTable).set({ isAdminActive: active }).where(eq(usersTable.id, id));
  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: active ? "activate_admin" : "deactivate_admin",
    targetType: "user",
    targetId: id,
    details: { email: target.email },
  });
  res.json({ success: true });
}

router.put("/admin/team/:id/deactivate", requirePermission("admin_accounts", "edit"), async (req, res) => setAdminActive(req, res, false));
router.put("/admin/team/:id/activate", requirePermission("admin_accounts", "edit"), async (req, res) => setAdminActive(req, res, true));

router.delete("/admin/team/:id", requirePermission("admin_accounts", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  if (id === req.auth!.userId) { res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" }); return; }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !isAdminRole(target.role)) { res.status(404).json({ error: "Administrateur introuvable" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: "delete_admin",
    targetType: "user",
    targetId: id,
    details: { email: target.email, name: target.name, role: target.role },
  });
  res.json({ success: true });
});

router.get("/admin/team/:id/activity", requirePermission("admin_accounts", "view"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  const rows = await db
    .select()
    .from(adminLogsTable)
    .where(eq(adminLogsTable.adminId, id))
    .orderBy(desc(adminLogsTable.createdAt))
    .limit(200);
  res.json(rows.map((r) => ({
    id: r.id,
    action: r.action,
    target_type: r.targetType,
    target_id: r.targetId,
    details: r.details,
    created_at: r.createdAt.toISOString(),
  })));
});

// Self-service: change own password (any admin role)
router.put("/admin/profile/password", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const current = typeof req.body?.current_password === "string" ? req.body.current_password : "";
  const next = typeof req.body?.new_password === "string" ? req.body.new_password : "";
  if (next.length < 8) { res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères" }); return; }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId));
  if (!u) { res.status(404).json({ error: "Compte introuvable" }); return; }
  if (!u.forcePasswordChange) {
    const ok = await bcryptjs.compare(current, u.passwordHash);
    if (!ok) { res.status(400).json({ error: "Mot de passe actuel incorrect" }); return; }
  }
  const passwordHash = await bcryptjs.hash(next, 10);
  // Bumping tokenVersion invalidates all OTHER sessions; we re-issue a fresh
  // token for the current session so the user stays logged in.
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash, forcePasswordChange: false, tokenVersion: sql`${usersTable.tokenVersion} + 1` })
    .where(eq(usersTable.id, req.auth!.userId))
    .returning({ tokenVersion: usersTable.tokenVersion });
  const token = jwt.sign(
    { userId: req.auth!.userId, role: req.auth!.role, tv: updated.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
  res.json({ success: true, token });
});

router.put("/admin/profile", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length < 2) { res.status(400).json({ error: "Nom invalide" }); return; }
  await db.update(usersTable).set({ name }).where(eq(usersTable.id, req.auth!.userId));
  res.json({ success: true });
});

export default router;
