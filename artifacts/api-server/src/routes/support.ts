import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db, supportTicketsTable, appSettingsTable } from "@workspace/db";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Support contact settings ────────────────────────────────────────────────
// Stored in `app_settings` (key/value). Falls back to env vars then defaults.

const SUPPORT_KEYS = ["support_whatsapp_number", "support_email", "support_hours"] as const;
type SupportKey = typeof SUPPORT_KEYS[number];

async function loadSupportSettings(): Promise<Record<SupportKey, string>> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, SUPPORT_KEYS as unknown as string[]));
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  return {
    support_whatsapp_number:
      map.get("support_whatsapp_number") ?? process.env.SUPPORT_WHATSAPP_NUMBER ?? "+2250700000000",
    support_email:
      map.get("support_email") ?? process.env.SUPPORT_EMAIL ?? "support@agroloopci.com",
    support_hours: map.get("support_hours") ?? process.env.SUPPORT_HOURS ?? "Lun–Sam 8h–18h",
  };
}

// Public — used by frontend support page / floating button.
router.get("/support/settings", async (_req, res): Promise<void> => {
  const s = await loadSupportSettings();
  const whatsappNumber = s.support_whatsapp_number.replace(/[^0-9]/g, "");
  res.json({
    whatsappNumber,
    whatsappDisplay: s.support_whatsapp_number,
    supportEmail: s.support_email,
    supportHours: s.support_hours,
  });
});

// Admin — read raw values for the settings page.
router.get(
  "/admin/support/settings",
  requireAuth,
  requireAdmin,
  requirePermission("settings", "view"),
  async (_req, res): Promise<void> => {
    const s = await loadSupportSettings();
    res.json({
      whatsappNumber: s.support_whatsapp_number,
      supportEmail: s.support_email,
      supportHours: s.support_hours,
    });
  },
);

// Admin — update support contact settings.
router.put(
  "/admin/support/settings",
  requireAuth,
  requireAdmin,
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const body = req.body ?? {};
    const updates: Array<{ key: SupportKey; value: string }> = [];
    const validatePhone = (v: string) => /^\+?[0-9 ()\-]{8,20}$/.test(v.trim());
    const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

    if (typeof body.whatsappNumber === "string") {
      const v = body.whatsappNumber.trim();
      if (!validatePhone(v)) { res.status(400).json({ error: "Numéro WhatsApp invalide" }); return; }
      updates.push({ key: "support_whatsapp_number", value: v });
    }
    if (typeof body.supportEmail === "string") {
      const v = body.supportEmail.trim();
      if (!validateEmail(v)) { res.status(400).json({ error: "Email invalide" }); return; }
      updates.push({ key: "support_email", value: v });
    }
    if (typeof body.supportHours === "string") {
      const v = body.supportHours.trim();
      if (v.length === 0 || v.length > 100) { res.status(400).json({ error: "Horaires invalides" }); return; }
      updates.push({ key: "support_hours", value: v });
    }

    if (updates.length === 0) { res.status(400).json({ error: "Aucun champ à mettre à jour" }); return; }

    for (const u of updates) {
      await db
        .insert(appSettingsTable)
        .values({ key: u.key, value: u.value, updatedBy: req.auth!.userId })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value: u.value, updatedBy: req.auth!.userId, updatedAt: new Date() },
        });
    }

    const s = await loadSupportSettings();
    res.json({
      whatsappNumber: s.support_whatsapp_number,
      supportEmail: s.support_email,
      supportHours: s.support_hours,
    });
  },
);

// ─── Legacy ticket endpoints (kept temporarily for backwards compat).
// New ticket system lives in support-tickets.ts; new endpoints take precedence.
// These remain as fallback for any old client using /support/tickets/mine.

const VALID_CATEGORIES = new Set([
  "compte",
  "verification",
  "paiement",
  "offre",
  "commande",
  "technique",
  "autre",
]);
type Category = "compte" | "verification" | "paiement" | "offre" | "commande" | "technique" | "autre";

function parseCreateBody(
  body: any,
): { ok: true; data: { subject: string; category: Category; message: string } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Corps invalide" };
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const category = typeof body.category === "string" ? body.category : "autre";
  if (subject.length < 3 || subject.length > 120) return { ok: false, error: "Sujet invalide (3 à 120 caractères)" };
  if (message.length < 10 || message.length > 2000) return { ok: false, error: "Message invalide (10 à 2000 caractères)" };
  if (!VALID_CATEGORIES.has(category)) return { ok: false, error: "Catégorie invalide" };
  return { ok: true, data: { subject, category: category as Category, message } };
}

function parseUpdateBody(
  body: any,
): { ok: true; data: { status?: Status; adminResponse?: string } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Corps invalide" };
  const out: { status?: Status; adminResponse?: string } = {};
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
      return { ok: false, error: "Statut invalide" };
    }
    out.status = body.status as Status;
  }
  if (body.adminResponse !== undefined) {
    if (typeof body.adminResponse !== "string") return { ok: false, error: "Réponse invalide" };
    const trimmed = body.adminResponse.trim();
    if (trimmed.length < 1 || trimmed.length > 4000) return { ok: false, error: "Réponse invalide (1 à 4000 caractères)" };
    out.adminResponse = trimmed;
  }
  return { ok: true, data: out };
}

function serializeTicket(t: any, user?: { id: number; name: string; email: string; role: string } | null) {
  return {
    id: t.id,
    userId: t.userId,
    subject: t.subject,
    category: t.category,
    message: t.message,
    status: t.status,
    adminResponse: t.adminResponse ?? null,
    handledByAdminId: t.handledByAdminId ?? null,
    respondedAt: t.respondedAt ? t.respondedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    user: user
      ? { id: user.id, name: user.name, email: user.email, role: user.role }
      : undefined,
  };
}

// NOTE: legacy admin ticket endpoints (GET /admin/support/tickets,
// PUT /admin/support/tickets/:id) have been removed in favour of the
// granular new router in support-tickets.ts which enforces the
// support_tickets.* permissions per action. The legacy PUT path bypassed the
// new permission model and has been deleted to avoid privilege escalation.

// Create a new support ticket (any authenticated user) — kept as fallback;
// new clients use the new POST in support-tickets.ts which is mounted first.
router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = parseCreateBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const userId = req.auth!.userId;

  // Simple rate-limit: max 5 open/in-progress tickets at once to prevent spam.
  const openCount = await db
    .select({ id: supportTicketsTable.id })
    .from(supportTicketsTable)
    .where(and(
      eq(supportTicketsTable.userId, userId),
      inArray(supportTicketsTable.status, ["ouvert", "en_cours"]),
    ));
  if (openCount.length >= 5) {
    res.status(429).json({
      error: "Vous avez déjà plusieurs demandes en attente. Veuillez patienter qu'elles soient traitées.",
    });
    return;
  }

  const [row] = await db
    .insert(supportTicketsTable)
    .values({
      userId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      message: parsed.data.message,
    })
    .returning();

  logger.info({ ticketId: row.id, userId, category: row.category }, "Support ticket created");
  res.status(201).json(serializeTicket(row));
});

// List current user's tickets
router.get("/support/tickets/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const rows = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, userId))
    .orderBy(desc(supportTicketsTable.createdAt));
  res.json({ items: rows.map((r) => serializeTicket(r)) });
});

export default router;
