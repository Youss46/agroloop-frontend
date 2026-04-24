import { Router, type IRouter } from "express";
import { eq, desc, and, or, ilike, sql, inArray, gte, lte, isNull, isNotNull } from "drizzle-orm";
import {
  db,
  supportTicketsTable,
  supportCategoriesTable,
  supportRepliesTable,
  supportTemplatesTable,
  supportTicketHistoryTable,
  usersTable,
  adminRolesTable,
  ADMIN_ROLES,
  isAdminRole,
} from "@workspace/db";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TICKET_STATUSES = ["ouvert", "en_cours", "resolu", "ferme", "spam", "doublon"] as const;
const TICKET_PRIORITIES = ["normale", "haute", "urgente"] as const;
type TicketStatus = typeof TICKET_STATUSES[number];
type TicketPriority = typeof TICKET_PRIORITIES[number];

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  ouvert: ["en_cours", "spam", "doublon", "resolu", "ferme"],
  en_cours: ["resolu", "spam", "ferme", "ouvert"],
  resolu: ["ferme", "en_cours"],
  ferme: ["en_cours"],
  spam: ["ouvert"],
  doublon: ["ouvert"],
};

async function nextReference(): Promise<string> {
  const year = new Date().getUTCFullYear();
  // Derive next sequence from the highest existing reference for this year
  // (more robust than count(*) under concurrent inserts; the unique constraint
  // on `reference` provides the final guarantee — caller retries on collision).
  const [{ maxRef }] = await db
    .select({ maxRef: sql<string | null>`max(reference)` })
    .from(supportTicketsTable)
    .where(sql`reference LIKE ${`TKT-${year}-%`}`);
  let seq = 1;
  if (maxRef) {
    const m = /TKT-\d{4}-(\d+)/.exec(maxRef);
    if (m) seq = parseInt(m[1]!, 10) + 1;
  }
  return `TKT-${year}-${String(seq).padStart(4, "0")}`;
}

async function insertWithUniqueReference<T>(
  build: (reference: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const ref = await nextReference();
      return await build(ref);
    } catch (err: any) {
      // Postgres unique violation on reference column → retry
      if (err?.code === "23505" && String(err?.constraint ?? err?.detail ?? "").includes("reference")) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("Could not allocate ticket reference");
}

function slaStatus(deadline: Date | null, breached: boolean): "ok" | "warning" | "breached" | "none" {
  if (!deadline) return "none";
  const now = Date.now();
  const dl = deadline.getTime();
  if (breached || now >= dl) return "breached";
  if (now >= dl - 3600_000) return "warning";
  return "ok";
}

function serializeCategory(c: any) {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    sla_hours: c.slaHours,
    is_active: c.isActive,
    position: c.position,
  };
}

function serializeTicket(t: any, extras: { user?: any; category?: any; assignee?: any; reply_count?: number; last_reply_at?: Date | null } = {}) {
  return {
    id: t.id,
    reference: t.reference,
    user_id: t.userId,
    sujet: t.subject,
    message: t.message,
    status: t.status,
    priority: t.priority,
    category_id: t.categoryId,
    category: t.category, // legacy text
    assigned_to: t.assignedTo,
    merged_into: t.mergedInto,
    resolved_at: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    closed_at: t.closedAt ? t.closedAt.toISOString() : null,
    sla_deadline: t.slaDeadline ? t.slaDeadline.toISOString() : null,
    sla_breached: t.slaBreached,
    sla_status: slaStatus(t.slaDeadline, t.slaBreached),
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
    user: extras.user ?? null,
    category_obj: extras.category ?? null,
    assignee: extras.assignee ?? null,
    reply_count: extras.reply_count ?? 0,
    last_reply_at: extras.last_reply_at ? extras.last_reply_at.toISOString() : null,
  };
}

function serializeReply(r: any, sender?: any) {
  return {
    id: r.id,
    ticket_id: r.ticketId,
    sender_id: r.senderId,
    message: r.message,
    is_internal_note: r.isInternalNote,
    is_template_reply: r.isTemplateReply,
    notification_sent: r.notificationSent,
    created_at: r.createdAt.toISOString(),
    sender: sender ?? null,
  };
}

async function getCategoryById(id: number) {
  const [c] = await db.select().from(supportCategoriesTable).where(eq(supportCategoriesTable.id, id)).limit(1);
  return c ?? null;
}

async function notifySupportAdmins(opts: { title: string; body: string; link?: string; excludeUserId?: number }): Promise<void> {
  // Find all users with admin role + support_tickets.view permission.
  const roles = await db.select().from(adminRolesTable);
  const allowedRoleNames = roles
    .filter((r) => Array.isArray((r.permissions as any)?.support_tickets) && ((r.permissions as any).support_tickets as string[]).includes("view"))
    .map((r) => r.name);
  if (allowedRoleNames.length === 0) return;

  const admins = await db
    .select({ id: usersTable.id, role: usersTable.role, adminRoleId: usersTable.adminRoleId })
    .from(usersTable)
    .where(and(
      inArray(usersTable.role, ADMIN_ROLES as unknown as string[]),
      eq(usersTable.isAdminActive, true),
    ));

  const roleById = new Map(roles.map((r) => [r.id, r.name]));
  for (const a of admins) {
    if (opts.excludeUserId && a.id === opts.excludeUserId) continue;
    const roleName = a.adminRoleId ? roleById.get(a.adminRoleId) : a.role;
    if (a.role === "super_admin" || a.role === "admin" || (roleName && allowedRoleNames.includes(roleName))) {
      await createNotification({
        userId: a.id,
        type: "support",
        title: opts.title,
        body: opts.body,
        link: opts.link ?? null,
      });
    }
  }
}

async function logHistory(ticketId: number, actorId: number | null, action: string, fromValue?: string | null, toValue?: string | null, note?: string | null): Promise<void> {
  await db.insert(supportTicketHistoryTable).values({
    ticketId,
    actorId: actorId ?? null,
    action,
    fromValue: fromValue ?? null,
    toValue: toValue ?? null,
    note: note ?? null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Create ticket — replaces the legacy POST /support/tickets
// Map legacy text category keys to display names used in supportCategoriesTable
const LEGACY_CATEGORY_NAME_MAP: Record<string, string> = {
  compte: "Compte",
  verification: "Vérification",
  paiement: "Paiement / Abonnement",
  offre: "Offre",
  commande: "Commande / Devis",
  technique: "Problème technique",
  autre: "Autre",
};

router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const body = req.body ?? {};
  const subject = typeof body.subject === "string" ? body.subject.trim() : (typeof body.sujet === "string" ? body.sujet.trim() : "");
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (subject.length < 3 || subject.length > 120) { res.status(400).json({ error: "Sujet invalide (3 à 120 caractères)" }); return; }
  if (message.length < 10 || message.length > 4000) { res.status(400).json({ error: "Message invalide (10 à 4000 caractères)" }); return; }

  // Accept either a numeric category_id OR the legacy text category key
  let rawCategoryId = Number(body.category_id ?? body.categoryId);
  let category: Awaited<ReturnType<typeof getCategoryById>> = null;

  if (Number.isFinite(rawCategoryId)) {
    category = await getCategoryById(rawCategoryId);
    if (!category || !category.isActive) { res.status(400).json({ error: "Catégorie invalide" }); return; }
  } else {
    // Legacy text key: try to resolve to a DB category by name
    const legacyKey = typeof body.category === "string" ? body.category.trim() : "autre";
    const targetName = LEGACY_CATEGORY_NAME_MAP[legacyKey] ?? legacyKey;
    const [found] = await db
      .select()
      .from(supportCategoriesTable)
      .where(and(eq(supportCategoriesTable.name, targetName), eq(supportCategoriesTable.isActive, true)))
      .limit(1);
    if (found) {
      category = found;
    }
    // If still no category found, proceed without one (no SLA)
  }

  // Resolve legacy category enum from the text key (for backwards compat column)
  const VALID_LEGACY: Record<string, string> = {
    compte: "compte", verification: "verification", paiement: "paiement",
    offre: "offre", commande: "commande", technique: "technique", autre: "autre",
  };
  const legacyEnumValue = VALID_LEGACY[typeof body.category === "string" ? body.category.trim() : ""] ?? "autre";

  const userId = req.auth!.userId;
  const openCount = await db
    .select({ id: supportTicketsTable.id })
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.userId, userId), inArray(supportTicketsTable.status, ["ouvert", "en_cours"])));
  if (openCount.length >= 5) {
    res.status(429).json({ error: "Vous avez déjà plusieurs demandes en attente. Veuillez patienter qu'elles soient traitées." });
    return;
  }

  const slaDeadline = category ? new Date(Date.now() + category.slaHours * 3600_000) : null;

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  const row = await insertWithUniqueReference(async (reference) => {
    const [r] = await db
      .insert(supportTicketsTable)
      .values({
        reference,
        userId,
        subject,
        message,
        categoryId: category ? category.id : null,
        category: legacyEnumValue as any,
        ...(slaDeadline ? { slaDeadline } : {}),
      })
      .returning();
    return r;
  });
  const reference = row.reference!;

  await logHistory(row.id, userId, "create", null, "ouvert");

  await notifySupportAdmins({
    title: `🎧 Nouveau ticket [${reference}]`,
    body: `${user?.name ?? "Utilisateur"} : ${subject}`,
    link: `/admin/support/${row.id}`,
  });

  logger.info({ ticketId: row.id, reference, userId }, "Support ticket created");
  res.status(201).json(serializeTicket(row, { category: category ? serializeCategory(category) : null }));
});

// List current user's tickets with reply count
router.get("/support/tickets/mes-tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const rows = await db
    .select({
      ticket: supportTicketsTable,
      category: supportCategoriesTable,
      reply_count: sql<number>`(select count(*)::int from support_replies where ticket_id = ${supportTicketsTable.id} and is_internal_note = false)`,
      last_reply_at: sql<Date | null>`(select max(created_at) from support_replies where ticket_id = ${supportTicketsTable.id} and is_internal_note = false)`,
    })
    .from(supportTicketsTable)
    .leftJoin(supportCategoriesTable, eq(supportCategoriesTable.id, supportTicketsTable.categoryId))
    .where(eq(supportTicketsTable.userId, userId))
    .orderBy(desc(supportTicketsTable.createdAt));
  res.json({
    items: rows.map((r) =>
      serializeTicket(r.ticket, {
        category: r.category ? serializeCategory(r.category) : null,
        reply_count: r.reply_count,
        last_reply_at: r.last_reply_at,
      }),
    ),
  });
});

// User: full ticket view with public replies
router.get("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
  const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!t || t.userId !== req.auth!.userId) { res.status(404).json({ error: "Ticket introuvable" }); return; }
  const category = t.categoryId ? await getCategoryById(t.categoryId) : null;

  const replies = await db
    .select({ r: supportRepliesTable, sId: usersTable.id, sName: usersTable.name, sRole: usersTable.role })
    .from(supportRepliesTable)
    .leftJoin(usersTable, eq(usersTable.id, supportRepliesTable.senderId))
    .where(and(eq(supportRepliesTable.ticketId, id), eq(supportRepliesTable.isInternalNote, false)))
    .orderBy(supportRepliesTable.createdAt);

  res.json({
    ticket: serializeTicket(t, { category: category ? serializeCategory(category) : null }),
    replies: replies.map((x) => serializeReply(x.r, x.sId ? { id: x.sId, name: x.sName, role: x.sRole } : null)),
  });
});

// User reply on own ticket — reopens if needed
router.post("/support/tickets/:id/reply", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
  if (message.length < 1 || message.length > 4000) { res.status(400).json({ error: "Message invalide (1 à 4000 caractères)" }); return; }

  const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!t || t.userId !== req.auth!.userId) { res.status(404).json({ error: "Ticket introuvable" }); return; }

  const [reply] = await db.insert(supportRepliesTable).values({
    ticketId: id,
    senderId: req.auth!.userId,
    message,
    isInternalNote: false,
  }).returning();

  const patch: any = { updatedAt: new Date() };
  let reopened = false;
  if (t.status === "resolu" || t.status === "ferme") {
    patch.status = "en_cours";
    patch.resolvedAt = null;
    patch.closedAt = null;
    reopened = true;
  }
  const [updated] = await db.update(supportTicketsTable).set(patch).where(eq(supportTicketsTable.id, id)).returning();

  if (reopened) await logHistory(id, req.auth!.userId, "reopen_by_user", t.status, "en_cours");

  if (updated.assignedTo) {
    await createNotification({
      userId: updated.assignedTo,
      type: "support",
      title: `💬 Réponse client [${updated.reference}]`,
      body: message.slice(0, 80),
      link: `/admin/support/${id}`,
    });
  } else {
    await notifySupportAdmins({
      title: `💬 Réponse client [${updated.reference}]`,
      body: message.slice(0, 80),
      link: `/admin/support/${id}`,
    });
  }

  res.status(201).json({ reply: serializeReply(reply), ticket_status: updated.status });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Stats — placed before /:id to avoid route conflict
router.get(
  "/admin/support/stats",
  requireAuth, requireAdmin, requirePermission("support_tickets", "stats"),
  async (_req, res): Promise<void> => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setUTCDate(startOfMonth.getUTCDate() - 30);

    const [counts] = await db
      .select({
        ouvert: sql<number>`count(*) filter (where status = 'ouvert')::int`,
        en_cours: sql<number>`count(*) filter (where status = 'en_cours')::int`,
        resolu: sql<number>`count(*) filter (where status = 'resolu')::int`,
        ferme: sql<number>`count(*) filter (where status = 'ferme')::int`,
        spam: sql<number>`count(*) filter (where status = 'spam')::int`,
        breach_total: sql<number>`count(*) filter (where sla_breached = true)::int`,
        priority_normale: sql<number>`count(*) filter (where status in ('ouvert','en_cours') and priority = 'normale')::int`,
        priority_haute: sql<number>`count(*) filter (where status in ('ouvert','en_cours') and priority = 'haute')::int`,
        priority_urgente: sql<number>`count(*) filter (where status in ('ouvert','en_cours') and priority = 'urgente')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(supportTicketsTable);

    const [today] = await db
      .select({
        new: sql<number>`count(*) filter (where created_at >= ${startOfDay})::int`,
        resolved: sql<number>`count(*) filter (where resolved_at >= ${startOfDay})::int`,
        avg_response_min: sql<number>`coalesce(avg(extract(epoch from (resolved_at - created_at)) / 60) filter (where resolved_at >= ${startOfDay}), 0)::int`,
      })
      .from(supportTicketsTable);

    const [week] = await db
      .select({
        new: sql<number>`count(*) filter (where created_at >= ${startOfWeek})::int`,
        resolved: sql<number>`count(*) filter (where resolved_at >= ${startOfWeek})::int`,
        breach_count: sql<number>`count(*) filter (where sla_breached = true and created_at >= ${startOfWeek})::int`,
      })
      .from(supportTicketsTable);

    const [month] = await db
      .select({
        new: sql<number>`count(*) filter (where created_at >= ${startOfMonth})::int`,
        resolved: sql<number>`count(*) filter (where resolved_at >= ${startOfMonth})::int`,
        breach_count: sql<number>`count(*) filter (where sla_breached = true and created_at >= ${startOfMonth})::int`,
      })
      .from(supportTicketsTable);

    const byCategory = await db
      .select({
        name: supportCategoriesTable.name,
        icon: supportCategoriesTable.icon,
        color: supportCategoriesTable.color,
        count: sql<number>`count(${supportTicketsTable.id})::int`,
        avg_hours: sql<number>`coalesce(avg(extract(epoch from (${supportTicketsTable.resolvedAt} - ${supportTicketsTable.createdAt})) / 3600) filter (where ${supportTicketsTable.resolvedAt} is not null), 0)::numeric(10,1)`,
      })
      .from(supportCategoriesTable)
      .leftJoin(supportTicketsTable, eq(supportTicketsTable.categoryId, supportCategoriesTable.id))
      .groupBy(supportCategoriesTable.id)
      .orderBy(desc(sql`count(${supportTicketsTable.id})`));

    const byAgent = await db
      .select({
        admin_id: usersTable.id,
        admin_name: usersTable.name,
        resolved: sql<number>`count(${supportTicketsTable.id}) filter (where ${supportTicketsTable.status} = 'resolu')::int`,
        avg_hours: sql<number>`coalesce(avg(extract(epoch from (${supportTicketsTable.resolvedAt} - ${supportTicketsTable.createdAt})) / 3600) filter (where ${supportTicketsTable.resolvedAt} is not null), 0)::numeric(10,1)`,
      })
      .from(supportTicketsTable)
      .innerJoin(usersTable, eq(usersTable.id, supportTicketsTable.assignedTo))
      .groupBy(usersTable.id)
      .orderBy(desc(sql`count(${supportTicketsTable.id})`));

    res.json({
      today: { new: today.new, resolved: today.resolved, avg_response_min: Number(today.avg_response_min) || 0 },
      week,
      month,
      by_category: byCategory.map((c) => ({ name: c.name, icon: c.icon, color: c.color, count: c.count, avg_hours: Number(c.avg_hours) })),
      by_agent: byAgent.map((a) => ({ admin_id: a.admin_id, admin_name: a.admin_name, resolved: a.resolved, avg_hours: Number(a.avg_hours) })),
      open_by_priority: { normale: counts.priority_normale, haute: counts.priority_haute, urgente: counts.priority_urgente },
      sla: { total: counts.total, breached: counts.breach_total, breach_rate: counts.total > 0 ? Number((counts.breach_total / counts.total * 100).toFixed(1)) : 0 },
      counts: { ouvert: counts.ouvert, en_cours: counts.en_cours, resolu: counts.resolu, ferme: counts.ferme, spam: counts.spam },
    });
  },
);

// List tickets with filters
router.get(
  "/admin/support/tickets",
  requireAuth, requireAdmin, requirePermission("support_tickets", "view"),
  async (req, res): Promise<void> => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" && (TICKET_STATUSES as readonly string[]).includes(req.query.status) ? req.query.status as TicketStatus : null;
    const priority = typeof req.query.priority === "string" && (TICKET_PRIORITIES as readonly string[]).includes(req.query.priority) ? req.query.priority as TicketPriority : null;
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const assignedTo = req.query.assigned_to === "me" ? req.auth!.userId : (req.query.assigned_to === "unassigned" ? "unassigned" : (req.query.assigned_to ? Number(req.query.assigned_to) : null));
    const slaBreached = req.query.sla_breached === "true";
    const dateFrom = typeof req.query.date_from === "string" ? new Date(req.query.date_from) : null;
    const dateTo = typeof req.query.date_to === "string" ? new Date(req.query.date_to) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(req.query.page_size) || 20));

    const conds: any[] = [];
    if (status) conds.push(eq(supportTicketsTable.status, status as any));
    if (priority) conds.push(eq(supportTicketsTable.priority, priority as any));
    if (categoryId && Number.isFinite(categoryId)) conds.push(eq(supportTicketsTable.categoryId, categoryId));
    if (assignedTo === "unassigned") conds.push(isNull(supportTicketsTable.assignedTo));
    else if (typeof assignedTo === "number" && Number.isFinite(assignedTo)) conds.push(eq(supportTicketsTable.assignedTo, assignedTo));
    if (slaBreached) conds.push(eq(supportTicketsTable.slaBreached, true));
    if (dateFrom && !isNaN(dateFrom.getTime())) conds.push(gte(supportTicketsTable.createdAt, dateFrom));
    if (dateTo && !isNaN(dateTo.getTime())) conds.push(lte(supportTicketsTable.createdAt, dateTo));
    if (q) {
      conds.push(or(
        ilike(supportTicketsTable.subject, `%${q}%`),
        ilike(supportTicketsTable.reference, `%${q}%`),
        ilike(usersTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
      ));
    }
    const where = conds.length ? and(...conds) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(supportTicketsTable)
      .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
      .where(where as any);

    const rows = await db
      .select({
        t: supportTicketsTable,
        u: { id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role },
        c: supportCategoriesTable,
        reply_count: sql<number>`(select count(*)::int from support_replies sr where sr.ticket_id = ${supportTicketsTable.id})`,
        last_reply_at: sql<Date | null>`(select max(created_at) from support_replies sr where sr.ticket_id = ${supportTicketsTable.id})`,
      })
      .from(supportTicketsTable)
      .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
      .leftJoin(supportCategoriesTable, eq(supportCategoriesTable.id, supportTicketsTable.categoryId))
      .where(where as any)
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Assignee names
    const assigneeIds = Array.from(new Set(rows.map((r) => r.t.assignedTo).filter((x): x is number => !!x)));
    const assignees = assigneeIds.length
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, assigneeIds))
      : [];
    const assigneeById = new Map(assignees.map((a) => [a.id, a]));

    res.json({
      page, pageSize, total,
      items: rows.map((r) =>
        serializeTicket(r.t, {
          user: r.u.id ? r.u : null,
          category: r.c ? serializeCategory(r.c) : null,
          assignee: r.t.assignedTo ? (assigneeById.get(r.t.assignedTo) ?? null) : null,
          reply_count: r.reply_count,
          last_reply_at: r.last_reply_at,
        }),
      ),
    });
  },
);

// Single ticket detail
router.get(
  "/admin/support/tickets/:id",
  requireAuth, requireAdmin, requirePermission("support_tickets", "view"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }

    const [row] = await db
      .select({ t: supportTicketsTable, u: usersTable, c: supportCategoriesTable })
      .from(supportTicketsTable)
      .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
      .leftJoin(supportCategoriesTable, eq(supportCategoriesTable.id, supportTicketsTable.categoryId))
      .where(eq(supportTicketsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    const replies = await db
      .select({ r: supportRepliesTable, sId: usersTable.id, sName: usersTable.name, sRole: usersTable.role })
      .from(supportRepliesTable)
      .leftJoin(usersTable, eq(usersTable.id, supportRepliesTable.senderId))
      .where(eq(supportRepliesTable.ticketId, id))
      .orderBy(supportRepliesTable.createdAt);

    const history = await db
      .select({ h: supportTicketHistoryTable, aName: usersTable.name })
      .from(supportTicketHistoryTable)
      .leftJoin(usersTable, eq(usersTable.id, supportTicketHistoryTable.actorId))
      .where(eq(supportTicketHistoryTable.ticketId, id))
      .orderBy(supportTicketHistoryTable.createdAt);

    let assignee: { id: number; name: string } | null = null;
    if (row.t.assignedTo) {
      const [a] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.t.assignedTo)).limit(1);
      assignee = a ?? null;
    }

    // User profile summary
    const userSummary = row.u ? {
      id: row.u.id,
      name: row.u.name,
      email: row.u.email,
      role: row.u.role,
      verification_status: row.u.verificationStatus ?? null,
      created_at: row.u.createdAt?.toISOString() ?? null,
    } : null;

    res.json({
      ticket: serializeTicket(row.t, {
        user: userSummary,
        category: row.c ? serializeCategory(row.c) : null,
        assignee,
      }),
      replies: replies.map((x) => serializeReply(x.r, x.sId ? { id: x.sId, name: x.sName, role: x.sRole } : null)),
      history: history.map((x) => ({
        id: x.h.id, action: x.h.action, from_value: x.h.fromValue, to_value: x.h.toValue, note: x.h.note,
        actor_name: x.aName ?? "Système", created_at: x.h.createdAt.toISOString(),
      })),
    });
  },
);

// Admin reply
router.post(
  "/admin/support/tickets/:id/reply",
  requireAuth, requireAdmin, requirePermission("support_tickets", "reply"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const isInternal = !!req.body?.is_internal_note;
    const templateId = req.body?.template_id ? Number(req.body.template_id) : null;
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    if (message.length < 1 || message.length > 4000) { res.status(400).json({ error: "Message invalide (1 à 4000 caractères)" }); return; }

    const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!t) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    const [reply] = await db.insert(supportRepliesTable).values({
      ticketId: id,
      senderId: req.auth!.userId,
      message,
      isInternalNote: isInternal,
      isTemplateReply: !!templateId,
      notificationSent: !isInternal,
    }).returning();

    const patch: any = { updatedAt: new Date() };
    if (!isInternal && t.status === "ouvert") patch.status = "en_cours";
    const [updated] = await db.update(supportTicketsTable).set(patch).where(eq(supportTicketsTable.id, id)).returning();

    if (templateId && Number.isFinite(templateId)) {
      await db.update(supportTemplatesTable).set({ usageCount: sql`${supportTemplatesTable.usageCount} + 1` }).where(eq(supportTemplatesTable.id, templateId));
    }

    if (!isInternal) {
      await createNotification({
        userId: t.userId,
        type: "support",
        title: `💬 Réponse à votre ticket [${t.reference}]`,
        body: message.slice(0, 80),
        link: `/aide/ticket/${id}`,
      });
    }

    res.status(201).json({ reply: serializeReply(reply), ticket_status: updated.status });
  },
);

// Status change with transition validation
router.put(
  "/admin/support/tickets/:id/status",
  requireAuth, requireAdmin, requirePermission("support_tickets", "reply"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? "");
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    if (!Number.isFinite(id) || !(TICKET_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: "Statut invalide" }); return;
    }
    const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!t) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    const allowed = VALID_TRANSITIONS[t.status as TicketStatus] ?? [];
    if (!allowed.includes(status as TicketStatus)) {
      res.status(400).json({ error: `Transition non autorisée: ${t.status} → ${status}` }); return;
    }
    if ((status === "spam" || status === "doublon") && !req.auth!.permissions?.support_tickets?.includes("mark_spam")) {
      res.status(403).json({ error: "Permission requise pour marquer comme spam/doublon" }); return;
    }
    if ((t.status === "resolu" || t.status === "ferme") && status === "en_cours" && !req.auth!.permissions?.support_tickets?.includes("reopen")) {
      res.status(403).json({ error: "Permission requise pour rouvrir un ticket" }); return;
    }

    const patch: any = { status, updatedAt: new Date() };
    if (status === "resolu") patch.resolvedAt = new Date();
    if (status === "ferme") patch.closedAt = new Date();
    if (status === "en_cours" && (t.status === "resolu" || t.status === "ferme")) {
      patch.resolvedAt = null; patch.closedAt = null;
    }

    const [updated] = await db.update(supportTicketsTable).set(patch).where(eq(supportTicketsTable.id, id)).returning();
    await logHistory(id, req.auth!.userId, "status_change", t.status, status, note);

    if (status === "resolu") {
      await createNotification({
        userId: t.userId,
        type: "support",
        title: `✅ Ticket résolu [${t.reference}]`,
        body: "Votre demande a été résolue. Satisfait ? Notez notre support.",
        link: `/aide/ticket/${id}`,
      });
    } else if (status === "ferme") {
      await createNotification({
        userId: t.userId,
        type: "support",
        title: `🔒 Ticket fermé [${t.reference}]`,
        body: "Votre demande a été clôturée.",
        link: `/aide/ticket/${id}`,
      });
    }
    res.json({ ticket: serializeTicket(updated) });
  },
);

// Assign
router.put(
  "/admin/support/tickets/:id/assign",
  requireAuth, requireAdmin, requirePermission("support_tickets", "assign"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const adminId = req.body?.admin_id === null ? null : Number(req.body?.admin_id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    if (adminId !== null && !Number.isFinite(adminId)) { res.status(400).json({ error: "Admin invalide" }); return; }

    const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!t) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    if (adminId !== null) {
      const [admin] = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role, adminRoleId: usersTable.adminRoleId, isActive: usersTable.isAdminActive })
        .from(usersTable).where(eq(usersTable.id, adminId)).limit(1);
      if (!admin || !isAdminRole(admin.role) || !admin.isActive) {
        res.status(400).json({ error: "Admin invalide ou inactif" }); return;
      }
      // Verify admin has support_tickets.view via their role
      if (admin.role !== "super_admin" && admin.role !== "admin") {
        if (!admin.adminRoleId) { res.status(400).json({ error: "Cet admin n'a pas accès au support" }); return; }
        const [role] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.id, admin.adminRoleId)).limit(1);
        const perms = (role?.permissions as any)?.support_tickets ?? [];
        if (!Array.isArray(perms) || !perms.includes("view")) {
          res.status(400).json({ error: "Cet admin n'a pas accès au support" }); return;
        }
      }
    }

    const [updated] = await db.update(supportTicketsTable).set({ assignedTo: adminId, updatedAt: new Date() }).where(eq(supportTicketsTable.id, id)).returning();
    await logHistory(id, req.auth!.userId, "assign", t.assignedTo ? String(t.assignedTo) : null, adminId ? String(adminId) : null);

    if (adminId) {
      await createNotification({
        userId: adminId,
        type: "support",
        title: `🎧 Ticket assigné [${t.reference}]`,
        body: `${t.subject}`,
        link: `/admin/support/${id}`,
      });
    }
    res.json({ ticket: serializeTicket(updated) });
  },
);

// Priority
router.put(
  "/admin/support/tickets/:id/priority",
  requireAuth, requireAdmin, requirePermission("support_tickets", "reply"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const priority = String(req.body?.priority ?? "");
    if (!Number.isFinite(id) || !(TICKET_PRIORITIES as readonly string[]).includes(priority)) {
      res.status(400).json({ error: "Priorité invalide" }); return;
    }
    const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!t) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    const patch: any = { priority, updatedAt: new Date() };
    // Only tighten SLA when transitioning into "urgente" (avoid cumulative
    // shifts when the same priority is re-applied multiple times).
    if (priority === "urgente" && t.priority !== "urgente" && t.slaDeadline) {
      patch.slaDeadline = new Date(t.slaDeadline.getTime() - 3600_000);
    }
    const [updated] = await db.update(supportTicketsTable).set(patch).where(eq(supportTicketsTable.id, id)).returning();
    await logHistory(id, req.auth!.userId, "priority_change", t.priority, priority);

    if (priority === "urgente") {
      await notifySupportAdmins({
        title: `🚨 Ticket urgent [${t.reference}]`,
        body: t.subject,
        link: `/admin/support/${id}`,
        excludeUserId: req.auth!.userId,
      });
    }
    res.json({ ticket: serializeTicket(updated) });
  },
);

// Merge
router.post(
  "/admin/support/tickets/:id/merge",
  requireAuth, requireAdmin, requirePermission("support_tickets", "merge"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const targetId = Number(req.body?.merge_into_id);
    if (!Number.isFinite(id) || !Number.isFinite(targetId) || id === targetId) {
      res.status(400).json({ error: "Identifiants invalides" }); return;
    }
    const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    const [target] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, targetId)).limit(1);
    if (!t || !target) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    await db.update(supportRepliesTable).set({ ticketId: targetId }).where(eq(supportRepliesTable.ticketId, id));
    const [updated] = await db.update(supportTicketsTable).set({ mergedInto: targetId, status: "doublon", updatedAt: new Date() }).where(eq(supportTicketsTable.id, id)).returning();
    await logHistory(id, req.auth!.userId, "merge", null, String(targetId));

    await createNotification({
      userId: t.userId,
      type: "support",
      title: `🔀 Ticket fusionné [${t.reference}]`,
      body: `Votre ticket a été fusionné avec ${target.reference}.`,
      link: `/aide/ticket/${targetId}`,
    });
    res.json({ ticket: serializeTicket(updated) });
  },
);

// Delete
router.delete(
  "/admin/support/tickets/:id",
  requireAuth, requireAdmin, requirePermission("support_tickets", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    const [t] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!t) { res.status(404).json({ error: "Ticket introuvable" }); return; }
    await db.delete(supportTicketsTable).where(eq(supportTicketsTable.id, id));
    res.json({ ok: true });
  },
);

// ─── Templates ───────────────────────────────────────────────────────────────

router.get(
  "/admin/support/templates",
  requireAuth, requireAdmin, requirePermission("support_tickets", "view"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({ t: supportTemplatesTable, c: supportCategoriesTable, creatorName: usersTable.name })
      .from(supportTemplatesTable)
      .leftJoin(supportCategoriesTable, eq(supportCategoriesTable.id, supportTemplatesTable.categoryId))
      .leftJoin(usersTable, eq(usersTable.id, supportTemplatesTable.createdBy))
      .orderBy(desc(supportTemplatesTable.usageCount));
    res.json({
      items: rows.map((r) => ({
        id: r.t.id, title: r.t.title, content: r.t.content,
        category_id: r.t.categoryId, category: r.c ? serializeCategory(r.c) : null,
        usage_count: r.t.usageCount, created_by_name: r.creatorName ?? null,
        created_at: r.t.createdAt.toISOString(), updated_at: r.t.updatedAt.toISOString(),
      })),
    });
  },
);

router.post(
  "/admin/support/templates",
  requireAuth, requireAdmin, requirePermission("support_tickets", "configure"),
  async (req, res): Promise<void> => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const categoryId = req.body?.category_id ? Number(req.body.category_id) : null;
    if (title.length < 2 || title.length > 100) { res.status(400).json({ error: "Titre invalide" }); return; }
    if (content.length < 5 || content.length > 4000) { res.status(400).json({ error: "Contenu invalide" }); return; }

    const [row] = await db.insert(supportTemplatesTable).values({
      title, content,
      categoryId: categoryId && Number.isFinite(categoryId) ? categoryId : null,
      createdBy: req.auth!.userId,
    }).returning();
    res.status(201).json({ template: row });
  },
);

router.put(
  "/admin/support/templates/:id",
  requireAuth, requireAdmin, requirePermission("support_tickets", "configure"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    const patch: any = { updatedAt: new Date() };
    if (typeof req.body?.title === "string") patch.title = req.body.title.trim();
    if (typeof req.body?.content === "string") patch.content = req.body.content.trim();
    if (req.body?.category_id !== undefined) patch.categoryId = req.body.category_id ? Number(req.body.category_id) : null;
    const [row] = await db.update(supportTemplatesTable).set(patch).where(eq(supportTemplatesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Modèle introuvable" }); return; }
    res.json({ template: row });
  },
);

router.delete(
  "/admin/support/templates/:id",
  requireAuth, requireAdmin, requirePermission("support_tickets", "configure"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    await db.delete(supportTemplatesTable).where(eq(supportTemplatesTable.id, id));
    res.json({ ok: true });
  },
);

// ─── Categories ──────────────────────────────────────────────────────────────

// Public (for the user ticket creation form)
router.get("/support/categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(supportCategoriesTable).where(eq(supportCategoriesTable.isActive, true)).orderBy(supportCategoriesTable.position);
  res.json({ items: rows.map(serializeCategory) });
});

router.get(
  "/admin/support/categories",
  requireAuth, requireAdmin, requirePermission("support_tickets", "view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(supportCategoriesTable).orderBy(supportCategoriesTable.position);
    res.json({ items: rows.map(serializeCategory) });
  },
);

router.post(
  "/admin/support/categories",
  requireAuth, requireAdmin, requirePermission("support_tickets", "configure"),
  async (req, res): Promise<void> => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const color = typeof req.body?.color === "string" ? req.body.color : "#6b7280";
    const icon = typeof req.body?.icon === "string" ? req.body.icon : "💬";
    const slaHours = Number(req.body?.sla_hours ?? 12);
    if (name.length < 2 || name.length > 50) { res.status(400).json({ error: "Nom invalide" }); return; }
    if (!Number.isFinite(slaHours) || slaHours < 1 || slaHours > 720) { res.status(400).json({ error: "SLA invalide (1-720h)" }); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { res.status(400).json({ error: "Couleur invalide" }); return; }

    const [{ maxPos }] = await db.select({ maxPos: sql<number>`coalesce(max(position), 0)::int` }).from(supportCategoriesTable);
    try {
      const [row] = await db.insert(supportCategoriesTable).values({ name, color, icon, slaHours, position: (maxPos ?? 0) + 1 }).returning();
      res.status(201).json({ category: serializeCategory(row) });
    } catch (err: any) {
      if (err?.code === "23505") { res.status(409).json({ error: "Une catégorie avec ce nom existe déjà" }); return; }
      throw err;
    }
  },
);

router.put(
  "/admin/support/categories/:id",
  requireAuth, requireAdmin, requirePermission("support_tickets", "configure"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    const patch: any = { updatedAt: new Date() };
    if (typeof req.body?.name === "string") patch.name = req.body.name.trim();
    if (typeof req.body?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(req.body.color)) patch.color = req.body.color;
    if (typeof req.body?.icon === "string") patch.icon = req.body.icon;
    if (req.body?.sla_hours !== undefined) {
      const sla = Number(req.body.sla_hours);
      if (!Number.isFinite(sla) || sla < 1 || sla > 720) { res.status(400).json({ error: "SLA invalide" }); return; }
      patch.slaHours = sla;
    }
    if (typeof req.body?.is_active === "boolean") patch.isActive = req.body.is_active;
    if (typeof req.body?.position === "number") patch.position = req.body.position;

    const [row] = await db.update(supportCategoriesTable).set(patch).where(eq(supportCategoriesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Catégorie introuvable" }); return; }
    res.json({ category: serializeCategory(row) });
  },
);

router.delete(
  "/admin/support/categories/:id",
  requireAuth, requireAdmin, requirePermission("support_tickets", "configure"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Identifiant invalide" }); return; }
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(supportTicketsTable).where(eq(supportTicketsTable.categoryId, id));
    if (count > 0) { res.status(409).json({ error: `Impossible de supprimer : ${count} ticket(s) utilisent cette catégorie` }); return; }
    await db.delete(supportCategoriesTable).where(eq(supportCategoriesTable.id, id));
    res.json({ ok: true });
  },
);

// ─── SLA cron job ────────────────────────────────────────────────────────────

export async function runSlaBreachCheck(): Promise<{ marked: number }> {
  const breached = await db
    .update(supportTicketsTable)
    .set({ slaBreached: true, updatedAt: new Date() })
    .where(and(
      eq(supportTicketsTable.slaBreached, false),
      isNotNull(supportTicketsTable.slaDeadline),
      lte(supportTicketsTable.slaDeadline, new Date()),
      inArray(supportTicketsTable.status, ["ouvert", "en_cours"]),
    ))
    .returning();

  for (const t of breached) {
    const hoursLate = t.slaDeadline ? Math.round((Date.now() - t.slaDeadline.getTime()) / 3600_000) : 0;
    if (t.assignedTo) {
      await createNotification({
        userId: t.assignedTo,
        type: "support",
        title: `⚠️ SLA dépassé — ${t.reference}`,
        body: `Délai dépassé de ${hoursLate}h`,
        link: `/admin/support/${t.id}`,
      });
    } else {
      await notifySupportAdmins({
        title: `⚠️ SLA dépassé — ${t.reference}`,
        body: `${t.subject} (délai dépassé de ${hoursLate}h)`,
        link: `/admin/support/${t.id}`,
      });
    }
    await logHistory(t.id, null, "sla_breach", "false", "true", `Dépassé de ${hoursLate}h`);
  }
  return { marked: breached.length };
}

export default router;
