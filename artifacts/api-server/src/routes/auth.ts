import { Router, type IRouter } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, adminRolesTable, isAdminRole, conversionEventsTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
} from "@workspace/api-zod";
import { serializeUser } from "../lib/serialize-user";
import { loginLimiter, loginIpLimiter, registerLimiter } from "../middlewares/rate-limit";
import { requireAuth } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

router.post("/auth/register", registerLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, role, phone, region } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (existing.length > 0) {
    res.status(409).json({ error: "Un compte avec cet email existe déjà" });
    return;
  }

  const passwordHash = await bcryptjs.hash(password, 10);
  let user;
  try {
    [user] = await db.insert(usersTable).values({
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      phone: phone ?? null,
      region: region ?? null,
    }).returning();
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Un compte avec cet email existe déjà" });
      return;
    }
    throw e;
  }

  const token = jwt.sign({ userId: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: "30d" });

  // Track registration conversion (fire-and-forget)
  const sessionId = (req as any).analyticsSessionId ?? "unknown";
  db.insert(conversionEventsTable).values({
    eventType: "register",
    userId: user.id,
    sessionId,
    metadata: { role: user.role },
  }).catch(() => { /* ignore */ });

  const firstName = (user.name ?? "").split(" ")[0] || user.name || "";
  const welcomeBody =
    user.role === "producteur"
      ? `Bienvenue ${firstName} ! Publiez vos résidus agricoles et commencez à les valoriser. Pensez à vérifier votre compte pour débloquer toutes les fonctionnalités.`
      : user.role === "transformateur"
      ? `Bienvenue ${firstName} ! Explorez les résidus agricoles disponibles et contactez les producteurs. Pensez à vérifier votre compte pour débloquer toutes les fonctionnalités.`
      : `Bienvenue ${firstName} sur AgroLoopCI !`;
  await createNotification({
    userId: user.id,
    type: "broadcast",
    title: "Bienvenue sur AgroLoopCI !",
    body: welcomeBody,
    link: "/verification",
  });

  res.status(201).json({ token, user: serializeUser(user) });
});

router.post("/auth/login", loginIpLimiter, loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

  if (!user) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const valid = await bcryptjs.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: `Compte suspendu: ${user.banReason ?? "raison non précisée"}` });
    return;
  }

  if (isAdminRole(user.role) && user.isAdminActive === false) {
    res.status(403).json({ error: "Compte administrateur désactivé. Contactez le Super Administrateur." });
    return;
  }

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  let adminRole = null as { name: string; label: string } | null;
  let permissions = null as Record<string, string[]> | null;
  if (user.adminRoleId) {
    const [ar] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.id, user.adminRoleId));
    if (ar) { adminRole = { name: ar.name, label: ar.label }; permissions = ar.permissions; }
  }

  const token = jwt.sign({ userId: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: "30d" });

  res.json({ token, user: serializeUser(user, { adminRole, permissions: permissions ?? undefined }) });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({ tokenVersion: sql`${usersTable.tokenVersion} + 1` })
    .where(eq(usersTable.id, req.auth!.userId));
  res.status(204).end();
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  let adminRole = null as { name: string; label: string } | null;
  let permissions = null as Record<string, string[]> | null;
  if (user.adminRoleId) {
    const [ar] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.id, user.adminRoleId));
    if (ar) { adminRole = { name: ar.name, label: ar.label }; permissions = ar.permissions; }
  }

  res.json(serializeUser(user, { adminRole, permissions: permissions ?? undefined }));
});

export default router;
