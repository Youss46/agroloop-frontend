import { Router, type IRouter } from "express";
import { and, eq, gte, lte, ilike, or, sql, desc, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  residusTable,
  transactionsTable,
  ratingsTable,
  adminLogsTable,
  notificationsTable,
  verificationRequestsTable,
  verificationDocumentsTable,
  subscriptionsTable,
  subscriptionInvoicesTable,
  plansTable,
  supportTicketsTable,
  flaggedOffersTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";

const P = requirePermission;

const router: IRouter = Router();

// All admin routes require auth + admin
router.use("/admin", requireAuth, requireAdmin);

async function logAdminAction(
  adminId: number,
  action: string,
  targetType: "user" | "offre" | "transaction" | "rating" | "broadcast" | "verification",
  targetId: number | null,
  details: Record<string, unknown> = {},
) {
  await db.insert(adminLogsTable).values({
    adminId,
    action,
    targetType,
    targetId: targetId ?? null,
    details,
  });
}

// ─── SIDEBAR BADGES ───────────────────────────────────────────────────────────
// Lightweight counts surfaced next to admin sidebar items. Each metric is
// individually permission-checked client-side; the endpoint itself is open to
// any authenticated admin so a single round-trip can populate the menu.
router.get("/admin/sidebar-badges", async (req, res): Promise<void> => {
  // Per-metric permission check (least privilege). A metric is set to 0 when the
  // caller lacks the corresponding read permission so the response never leaks
  // counts for domains the admin sub-role isn't allowed to see.
  const can = (resource: string, action: string) => {
    // Legacy 'admin' role retains full access (matches requirePermission behavior).
    if (req.auth?.role === "admin" || req.auth?.role === "super_admin") return true;
    const perms = (req.auth?.permissions ?? {}) as Record<string, string[]>;
    return Array.isArray(perms[resource]) && perms[resource].includes(action);
  };

  const [vRow] = can("verifications", "view")
    ? await db
        .select({ c: sql<number>`count(*)::int` })
        .from(verificationRequestsTable)
        .where(eq(verificationRequestsTable.status, "en_attente"))
    : [{ c: 0 }];
  const [sRow] = can("subscriptions", "view")
    ? await db
        .select({ c: sql<number>`count(*)::int` })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "en_attente"))
    : [{ c: 0 }];
  const [tRow] = can("support_tickets", "view")
    ? await db
        .select({ c: sql<number>`count(*)::int` })
        .from(supportTicketsTable)
        .where(inArray(supportTicketsTable.status, ["ouvert", "en_cours"]))
    : [{ c: 0 }];
  const [rRow] = can("ratings", "view")
    ? await db
        .select({ c: sql<number>`count(*)::int` })
        .from(ratingsTable)
        .where(eq(ratingsTable.flagged, true))
    : [{ c: 0 }];
  const [foRow] = can("ratings", "view")
    ? await db
        .select({ c: sql<number>`count(*)::int` })
        .from(flaggedOffersTable)
        .where(eq(flaggedOffersTable.status, "en_attente"))
    : [{ c: 0 }];
  res.json({
    verifications_pending: vRow?.c ?? 0,
    subscriptions_pending: sRow?.c ?? 0,
    support_open: tRow?.c ?? 0,
    ratings_flagged: rRow?.c ?? 0,
    offers_flagged: foRow?.c ?? 0,
    moderation_total: (rRow?.c ?? 0) + (foRow?.c ?? 0),
  });
});

// ─── STATS ────────────────────────────────────────────────────────────────────
router.get("/admin/stats", P("reports", "view"), async (_req, res): Promise<void> => {
  const usersByRoleRows: any[] = (await db.execute(sql`SELECT role, COUNT(*)::int as count FROM users GROUP BY role`)).rows ?? [];
  const offresByStatusRows: any[] = (await db.execute(sql`SELECT status, COUNT(*)::int as count FROM residus GROUP BY status`)).rows ?? [];
  const txByStatusRows: any[] = (await db.execute(sql`SELECT status, COUNT(*)::int as count, COALESCE(SUM(total_fcfa),0)::bigint as volume FROM transactions GROUP BY status`)).rows ?? [];
  const totalKgRow: any = (await db.execute(sql`SELECT COALESCE(SUM(quantity_kg),0)::bigint as total FROM transactions WHERE status = 'confirmée'`)).rows?.[0] ?? { total: 0 };
  const newUsersWeekRow: any = (await db.execute(sql`SELECT COUNT(*)::int as count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`)).rows?.[0] ?? { count: 0 };
  const newOffresWeekRow: any = (await db.execute(sql`SELECT COUNT(*)::int as count FROM residus WHERE created_at >= NOW() - INTERVAL '7 days'`)).rows?.[0] ?? { count: 0 };
  const topRegionsRows: any[] = (await db.execute(sql`SELECT region, COUNT(*)::int as count FROM residus GROUP BY region ORDER BY count DESC LIMIT 5`)).rows ?? [];
  const topResidusRows: any[] = (await db.execute(sql`SELECT type_residu, COALESCE(SUM(quantity_kg),0)::bigint as volume FROM residus GROUP BY type_residu ORDER BY volume DESC LIMIT 5`)).rows ?? [];
  const revenueRow: any = (await db.execute(sql`SELECT COALESCE(SUM(total_fcfa),0)::bigint as total FROM transactions WHERE status = 'confirmée'`)).rows?.[0] ?? { total: 0 };
  const weeklyRows: any[] = (await db.execute(sql`
    SELECT date_trunc('week', created_at) AS week, COUNT(*)::int AS count
    FROM users
    WHERE created_at >= NOW() - INTERVAL '8 weeks'
    GROUP BY week ORDER BY week ASC
  `)).rows ?? [];
  const txByRegionRows: any[] = (await db.execute(sql`
    SELECT r.region, COUNT(*)::int AS count
    FROM transactions t JOIN residus r ON r.id = t.residu_id
    GROUP BY r.region ORDER BY count DESC LIMIT 8
  `)).rows ?? [];

  const totalKg = Number(totalKgRow.total);
  const totalVolume = txByStatusRows.reduce((acc: number, r: any) => acc + Number(r.volume), 0);
  const confirmedVolume = Number(txByStatusRows.find((r: any) => r.status === "confirmée")?.volume ?? 0);

  res.json({
    totalUsers: usersByRoleRows.reduce((s: number, r: any) => s + r.count, 0),
    usersByRole: Object.fromEntries(usersByRoleRows.map((r: any) => [r.role, r.count])),
    totalOffres: offresByStatusRows.reduce((s: number, r: any) => s + r.count, 0),
    offresByStatus: Object.fromEntries(offresByStatusRows.map((r: any) => [r.status, r.count])),
    totalTransactions: txByStatusRows.reduce((s: number, r: any) => s + r.count, 0),
    transactionsByStatus: Object.fromEntries(txByStatusRows.map((r: any) => [r.status, r.count])),
    totalVolumeFcfa: totalVolume,
    totalKgValorises: totalKg,
    co2EviteKg: Math.round(totalKg * 0.8),
    newUsersThisWeek: newUsersWeekRow.count,
    newOffresThisWeek: newOffresWeekRow.count,
    topRegions: topRegionsRows.map((r: any) => ({ region: r.region, count: r.count })),
    topResidus: topResidusRows.map((r: any) => ({ type: r.type_residu, volume: Number(r.volume) })),
    revenueEstime: Math.round(confirmedVolume * 0.04),
    weeklyRegistrations: weeklyRows.map((r: any) => ({ week: r.week, count: r.count })),
    transactionsByRegion: txByRegionRows.map((r: any) => ({ region: r.region, count: r.count })),
  });
});

// ─── USERS ────────────────────────────────────────────────────────────────────
router.get("/admin/users", P("users", "view"), async (req, res): Promise<void> => {
  const { role, region, is_banned, search, date_from, date_to } = req.query as any;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  const conds: any[] = [];
  if (role) conds.push(eq(usersTable.role, role));
  if (region) conds.push(eq(usersTable.region, region));
  if (is_banned === "true") conds.push(eq(usersTable.isBanned, true));
  if (is_banned === "false") conds.push(eq(usersTable.isBanned, false));
  if (search) conds.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`)));
  if (date_from) conds.push(gte(usersTable.createdAt, new Date(date_from)));
  if (date_to) conds.push(lte(usersTable.createdAt, new Date(date_to)));

  const where = conds.length ? and(...conds) : undefined;

  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int as count FROM users ${where ? sql`WHERE ${where}` : sql``}` as any,
  ).then((r: any) => r.rows ?? [{ count: 0 }]);

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      region: usersTable.region,
      ratingAvg: usersTable.ratingAvg,
      ratingCount: usersTable.ratingCount,
      isBanned: usersTable.isBanned,
      banReason: usersTable.banReason,
      lastLogin: usersTable.lastLogin,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(where)
    .orderBy(desc(usersTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const ids = rows.map(r => r.id);
  const txCounts: Record<number, number> = {};
  if (ids.length) {
    const txRows: any[] = (await db.execute(sql`
      SELECT seller_id AS uid, COUNT(*)::int AS c FROM transactions WHERE seller_id IN ${ids} GROUP BY seller_id
      UNION ALL
      SELECT buyer_id AS uid, COUNT(*)::int AS c FROM transactions WHERE buyer_id IN ${ids} GROUP BY buyer_id
    `)).rows ?? [];
    for (const r of txRows) {
      txCounts[r.uid] = (txCounts[r.uid] ?? 0) + Number(r.c);
    }
  }

  res.json({
    page, pageSize, total: Number(count),
    users: rows.map(r => ({
      ...r,
      ratingAvg: Number(r.ratingAvg ?? 0),
      ratingCount: r.ratingCount ?? 0,
      lastLogin: r.lastLogin ? r.lastLogin.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      totalTransactions: txCounts[r.id] ?? 0,
    })),
  });
});

router.get("/admin/users/:id", P("users", "view"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) { res.status(404).json({ error: "Introuvable" }); return; }
  res.json({
    ...u,
    passwordHash: undefined,
    ratingAvg: Number(u.ratingAvg ?? 0),
    ratingCount: u.ratingCount ?? 0,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  });
});

// Only super_admin (or legacy 'admin') may act on a super_admin/admin target.
const isSuperAdminRole = (r?: string | null) => r === "super_admin" || r === "admin";
async function assertCanActOnTarget(req: any, res: any, targetId: number): Promise<{ role: string | null } | null> {
  const [t] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, targetId));
  if (!t) { res.status(404).json({ error: "Introuvable" }); return null; }
  if (isSuperAdminRole(t.role) && !isSuperAdminRole(req.auth?.role)) {
    res.status(403).json({ error: "Seul un Super Administrateur peut agir sur un compte Super Administrateur" });
    return null;
  }
  return { role: t.role };
}

router.put("/admin/users/:id/ban", P("users", "ban"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = (req.body?.reason ?? "").toString().slice(0, 500);
  if (id === req.auth!.userId) { res.status(400).json({ error: "Vous ne pouvez pas vous bannir vous-même" }); return; }
  if (!(await assertCanActOnTarget(req, res, id))) return;
  const [updated] = await db.update(usersTable).set({ isBanned: true, banReason: reason || null }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Introuvable" }); return; }
  await logAdminAction(req.auth!.userId, "ban_user", "user", id, { reason });
  res.json({ success: true });
});

router.put("/admin/users/:id/unban", P("users", "ban"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!(await assertCanActOnTarget(req, res, id))) return;
  const [updated] = await db.update(usersTable).set({ isBanned: false, banReason: null }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Introuvable" }); return; }
  await logAdminAction(req.auth!.userId, "unban_user", "user", id, {});
  res.json({ success: true });
});

router.delete("/admin/users/:id", P("users", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (id === req.auth!.userId) { res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" }); return; }
  if (!(await assertCanActOnTarget(req, res, id))) return;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) { res.status(404).json({ error: "Introuvable" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await logAdminAction(req.auth!.userId, "delete_user", "user", id, { email: u.email, name: u.name });
  res.json({ success: true });
});

// ─── OFFRES ───────────────────────────────────────────────────────────────────
router.get("/admin/offres", P("offres", "view"), async (req, res): Promise<void> => {
  const { type_residu, region, status, search, date_from, date_to } = req.query as any;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  const conds: any[] = [];
  if (type_residu) conds.push(eq(residusTable.typeResidu, type_residu));
  if (region) conds.push(eq(residusTable.region, region));
  if (status) conds.push(eq(residusTable.status, status));
  if (search) conds.push(or(ilike(residusTable.typeResidu, `%${search}%`), ilike(residusTable.description, `%${search}%`)));
  if (date_from) conds.push(gte(residusTable.createdAt, new Date(date_from)));
  if (date_to) conds.push(lte(residusTable.createdAt, new Date(date_to)));
  const where = conds.length ? and(...conds) : undefined;

  const countRow: any = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM residus ${where ? sql`WHERE ${where}` : sql``}`)).rows?.[0] ?? { count: 0 };

  const rows = await db
    .select({
      id: residusTable.id,
      typeResidu: residusTable.typeResidu,
      region: residusTable.region,
      quantityKg: residusTable.quantityKg,
      priceFcfa: residusTable.priceFcfa,
      status: residusTable.status,
      createdAt: residusTable.createdAt,
      sellerId: residusTable.userId,
      sellerName: usersTable.name,
    })
    .from(residusTable)
    .leftJoin(usersTable, eq(residusTable.userId, usersTable.id))
    .where(where)
    .orderBy(desc(residusTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  res.json({
    page, pageSize, total: Number(countRow.count),
    offres: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), sellerName: r.sellerName ?? "Inconnu" })),
  });
});

router.put("/admin/offres/:id/status", P("offres", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const status = req.body?.status as "disponible" | "vendu" | "expiré";
  if (!["disponible", "vendu", "expiré"].includes(status)) { res.status(400).json({ error: "Statut invalide" }); return; }
  const [updated] = await db.update(residusTable).set({ status }).where(eq(residusTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Introuvable" }); return; }
  await logAdminAction(req.auth!.userId, "force_offre_status", "offre", id, { status });
  res.json({ success: true });
});

router.delete("/admin/offres/:id", P("offres", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = (req.body?.reason ?? "").toString().slice(0, 500);
  const [o] = await db.select().from(residusTable).where(eq(residusTable.id, id));
  if (!o) { res.status(404).json({ error: "Introuvable" }); return; }
  await db.delete(residusTable).where(eq(residusTable.id, id));
  await logAdminAction(req.auth!.userId, "delete_offre", "offre", id, { reason, type: o.typeResidu });
  res.json({ success: true });
});

router.post("/admin/offres/bulk", P("offres", "delete"), async (req, res): Promise<void> => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x: any) => Number(x)).filter(Number.isFinite) : [];
  const action = req.body?.action as "delete" | "expire";
  if (!ids.length) { res.status(400).json({ error: "Aucun ID fourni" }); return; }
  let affected: any[] = [];
  if (action === "delete") {
    affected = await db.delete(residusTable).where(inArray(residusTable.id, ids)).returning({ id: residusTable.id });
  } else if (action === "expire") {
    affected = await db.update(residusTable).set({ status: "expiré" }).where(inArray(residusTable.id, ids)).returning({ id: residusTable.id });
  } else {
    res.status(400).json({ error: "Action invalide" }); return;
  }
  await logAdminAction(req.auth!.userId, `bulk_${action}_offres`, "offre", null, { ids, affected: affected.length });
  res.json({ success: true, count: affected.length });
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
router.get("/admin/transactions", P("transactions", "view"), async (req, res): Promise<void> => {
  const { status, date_from, date_to, search } = req.query as any;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  const filterParts: any[] = [];
  if (status) filterParts.push(sql`t.status = ${status}`);
  if (date_from) filterParts.push(sql`t.created_at >= ${new Date(date_from)}`);
  if (date_to) filterParts.push(sql`t.created_at <= ${new Date(date_to)}`);
  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    const like = `%${term}%`;
    const asNum = Number(term);
    const idMatch = Number.isInteger(asNum) && asNum > 0;
    filterParts.push(idMatch
      ? sql`(r.type_residu ILIKE ${like} OR r.region ILIKE ${like} OR s.name ILIKE ${like} OR b.name ILIKE ${like} OR t.id = ${asNum})`
      : sql`(r.type_residu ILIKE ${like} OR r.region ILIKE ${like} OR s.name ILIKE ${like} OR b.name ILIKE ${like})`);
  }
  const whereSql = filterParts.length
    ? sql`WHERE ${sql.join(filterParts, sql` AND `)}`
    : sql``;

  const countRow: any = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM transactions t
    LEFT JOIN residus r ON r.id = t.residu_id
    LEFT JOIN users s ON s.id = t.seller_id
    LEFT JOIN users b ON b.id = t.buyer_id
    ${whereSql}
  `)).rows?.[0] ?? { count: 0 };
  const sumRow: any = (await db.execute(sql`SELECT COALESCE(SUM(total_fcfa),0)::bigint AS total FROM transactions WHERE status = 'confirmée'`)).rows?.[0] ?? { total: 0 };
  const monthRow: any = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM transactions WHERE created_at >= date_trunc('month', NOW())`)).rows?.[0] ?? { count: 0 };

  const rows: any[] = (await db.execute(sql`
    SELECT t.id, t.status, t.created_at, t.quantity_kg, t.total_fcfa, t.residu_id, t.seller_id, t.buyer_id,
           r.type_residu, r.region,
           s.name AS seller_name, b.name AS buyer_name
    FROM transactions t
    LEFT JOIN residus r ON r.id = t.residu_id
    LEFT JOIN users s ON s.id = t.seller_id
    LEFT JOIN users b ON b.id = t.buyer_id
    ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `)).rows ?? [];

  res.json({
    page, pageSize, total: Number(countRow.count),
    totalVolumeFcfa: Number(sumRow.total),
    commissionEstimee: Math.round(Number(sumRow.total) * 0.04),
    transactionsCeMois: Number(monthRow.count),
    transactions: rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      quantityKg: Number(r.quantity_kg),
      priceFcfa: Number(r.total_fcfa),
      commission: Math.round(Number(r.total_fcfa) * 0.04),
      typeResidu: r.type_residu,
      region: r.region,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      buyerId: r.buyer_id,
      buyerName: r.buyer_name,
    })),
  });
});

const TX_STATUSES = ["en_attente", "confirmée", "annulée"] as const;
router.put("/admin/transactions/:id/status", P("transactions", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const status = req.body?.status as string;
  if (!TX_STATUSES.includes(status as any)) {
    res.status(400).json({ error: `Statut invalide. Valeurs: ${TX_STATUSES.join(", ")}` });
    return;
  }
  const [updated] = await db.update(transactionsTable).set({ status: status as any }).where(eq(transactionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Introuvable" }); return; }
  await logAdminAction(req.auth!.userId, "force_transaction_status", "transaction", id, { status });
  res.json({ success: true });
});

// ─── RATINGS ──────────────────────────────────────────────────────────────────
router.get("/admin/ratings", P("ratings", "view"), async (req, res): Promise<void> => {
  const filter = req.query.filter as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  const conds: any[] = [];
  if (filter === "low") conds.push(lte(ratingsTable.stars, 2));
  if (filter === "flagged") conds.push(eq(sql`flagged`, true));
  const where = conds.length ? and(...conds) : undefined;

  const countRow: any = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM ratings ${where ? sql`WHERE ${where}` : sql``}`)).rows?.[0] ?? { count: 0 };

  const rows: any[] = (await db.execute(sql`
    SELECT rt.id, rt.stars, rt.comment, rt.created_at, rt.transaction_id, rt.flagged,
           rev.id AS reviewer_id, rev.name AS reviewer_name,
           rwe.id AS reviewee_id, rwe.name AS reviewee_name
    FROM ratings rt
    LEFT JOIN users rev ON rev.id = rt.reviewer_id
    LEFT JOIN users rwe ON rwe.id = rt.reviewee_id
    ${where ? sql`WHERE ${where}` : sql``}
    ORDER BY rt.created_at DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `)).rows ?? [];

  res.json({
    page, pageSize, total: Number(countRow.count),
    ratings: rows.map((r: any) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: new Date(r.created_at).toISOString(),
      transactionId: r.transaction_id,
      flagged: !!r.flagged,
      reviewerId: r.reviewer_id,
      reviewerName: r.reviewer_name,
      revieweeId: r.reviewee_id,
      revieweeName: r.reviewee_name,
    })),
  });
});

router.put("/admin/ratings/:id/flag", P("ratings", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const flagged = !!req.body?.flagged;
  await db.execute(sql`UPDATE ratings SET flagged = ${flagged} WHERE id = ${id}`);
  await logAdminAction(req.auth!.userId, flagged ? "flag_rating" : "unflag_rating", "rating", id, {});
  res.json({ success: true });
});

router.delete("/admin/ratings/:id", P("ratings", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(ratingsTable).where(eq(ratingsTable.id, id));
  await logAdminAction(req.auth!.userId, "delete_rating", "rating", id, {});
  res.json({ success: true });
});

// ─── FLAGGED OFFERS (MODERATION) ──────────────────────────────────────────────
router.get("/admin/flagged-offers", P("ratings", "view"), async (req, res): Promise<void> => {
  const ALLOWED_STATUS = ["en_attente", "traité"];
  const status = (req.query.status as string) || "en_attente";
  if (!ALLOWED_STATUS.includes(status)) { res.status(400).json({ error: "Statut invalide" }); return; }
  const rows: any[] = (await db.execute(sql`
    SELECT fo.id, fo.offre_id, fo.reason, fo.comment, fo.status, fo.admin_decision,
           fo.created_at, fo.reviewed_at,
           r.type_residu, r.region, r.status AS offre_status,
           reporter.id AS reporter_id, reporter.name AS reporter_name,
           seller.id AS seller_id, seller.name AS seller_name
    FROM flagged_offers fo
    LEFT JOIN residus r ON r.id = fo.offre_id
    LEFT JOIN users reporter ON reporter.id = fo.reported_by
    LEFT JOIN users seller ON seller.id = r.user_id
    WHERE fo.status = ${status}::flagged_offer_status
    ORDER BY fo.created_at DESC
    LIMIT 100
  `)).rows ?? [];
  res.json({
    flags: rows.map((r: any) => ({
      id: r.id,
      offreId: r.offre_id,
      offreTitre: r.type_residu,
      offreRegion: r.region,
      offreStatus: r.offre_status,
      reason: r.reason,
      comment: r.comment,
      status: r.status,
      adminDecision: r.admin_decision,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
      reporterId: r.reporter_id,
      reporterName: r.reporter_name,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
    })),
  });
});

router.put("/admin/flagged-offers/:id", P("ratings", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID invalide" }); return; }
  const decision = String(req.body?.decision ?? "").trim().slice(0, 2000);
  const removeOffer = !!req.body?.removeOffer;
  if (!decision) { res.status(400).json({ error: "Décision requise" }); return; }

  // Destructive offer removal requires explicit offers.moderate permission (or legacy admin).
  if (removeOffer) {
    const perms = req.auth?.permissions ?? {};
    const allowed = Array.isArray(perms.offres) && (perms.offres.includes("moderate") || perms.offres.includes("delete"));
    if (!allowed && req.auth?.role !== "admin") {
      res.status(403).json({ error: "PERMISSION_DENIED", message: "La suppression d'offre nécessite la permission offres.moderate", required: { resource: "offres", action: "moderate" } });
      return;
    }
  }

  const [flag] = await db.select().from(flaggedOffersTable).where(eq(flaggedOffersTable.id, id)).limit(1);
  if (!flag) { res.status(404).json({ error: "Introuvable" }); return; }

  await db.update(flaggedOffersTable).set({
    status: "traité",
    adminDecision: decision,
    reviewedBy: req.auth!.userId,
    reviewedAt: new Date(),
  }).where(eq(flaggedOffersTable.id, id));

  if (removeOffer) {
    await db.update(residusTable).set({ status: "expiré" }).where(eq(residusTable.id, flag.offreId));
  }

  await logAdminAction(req.auth!.userId, removeOffer ? "remove_flagged_offer" : "review_flagged_offer", "offre", flag.offreId, { decision, removeOffer });
  res.json({ success: true });
});

// ─── BROADCAST ────────────────────────────────────────────────────────────────
function validateAudience(audience: string, audienceValue?: string): string | null {
  if (!["all", "producteur", "transformateur", "region"].includes(audience)) {
    return `Audience invalide`;
  }
  if (audience === "region" && !audienceValue) {
    return `audienceValue requis quand audience=region`;
  }
  return null;
}

router.post("/admin/broadcast/preview", P("broadcast", "send"), async (req, res): Promise<void> => {
  const audience = req.body?.audience as string;
  const audienceValue = req.body?.audienceValue as string | undefined;
  const err = validateAudience(audience, audienceValue);
  if (err) { res.status(400).json({ error: err }); return; }
  const conds: any[] = [];
  if (audience === "producteur") conds.push(eq(usersTable.role, "producteur"));
  else if (audience === "transformateur") conds.push(eq(usersTable.role, "transformateur"));
  else if (audience === "region") conds.push(eq(usersTable.region, audienceValue!));
  conds.push(eq(usersTable.isBanned, false));
  const row: any = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM users WHERE ${and(...conds)}`)).rows?.[0] ?? { count: 0 };
  res.json({ count: Number(row.count) });
});

router.post("/admin/broadcast", P("broadcast", "send"), async (req, res): Promise<void> => {
  const title = (req.body?.title ?? "").toString().slice(0, 200);
  const message = (req.body?.message ?? "").toString().slice(0, 2000);
  const audience = req.body?.audience as "all" | "producteur" | "transformateur" | "region";
  const audienceValue = req.body?.audienceValue as string | undefined;
  const linkRaw = (req.body?.link ?? "").toString().trim().slice(0, 500);
  const link = linkRaw || null;
  if (link && !/^(https?:\/\/|\/)/i.test(link)) {
    res.status(400).json({ error: "Lien invalide (doit commencer par http(s):// ou /)" });
    return;
  }
  if (!title || !message) {
    res.status(400).json({ error: "Titre et message requis" });
    return;
  }
  const audErr = validateAudience(audience, audienceValue);
  if (audErr) { res.status(400).json({ error: audErr }); return; }
  const conds: any[] = [];
  if (audience === "producteur") conds.push(eq(usersTable.role, "producteur"));
  else if (audience === "transformateur") conds.push(eq(usersTable.role, "transformateur"));
  else if (audience === "region" && audienceValue) conds.push(eq(usersTable.region, audienceValue));
  conds.push(eq(usersTable.isBanned, false));
  const row: any = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM users WHERE ${and(...conds)}`)).rows?.[0] ?? { count: 0 };
  const reach = Number(row.count);

  const [n] = await db.insert(notificationsTable).values({
    title, message, audience,
    audienceValue: audience === "region" ? (audienceValue ?? null) : null,
    link,
    sentBy: req.auth!.userId,
    reach,
  }).returning();
  await logAdminAction(req.auth!.userId, "broadcast", "broadcast", n.id, { audience, audienceValue, reach });
  res.json({ id: n.id, reach });
});

router.get("/admin/broadcast", P("broadcast", "send"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(50);
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// ─── ADMIN LOGS ───────────────────────────────────────────────────────────────
router.get("/admin/logs", P("audit_logs", "view"), async (req, res): Promise<void> => {
  const { action, target_type, date_from, date_to, search } = req.query as any;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 50;

  const parts: any[] = [];
  if (action) parts.push(sql`al.action = ${action}`);
  if (target_type) parts.push(sql`al.target_type = ${target_type}`);
  if (date_from) parts.push(sql`al.created_at >= ${new Date(date_from)}`);
  if (date_to) parts.push(sql`al.created_at <= ${new Date(date_to)}`);
  if (search && typeof search === "string" && search.trim()) {
    const like = `%${search.trim()}%`;
    parts.push(sql`(u.name ILIKE ${like} OR al.action ILIKE ${like} OR al.details::text ILIKE ${like})`);
  }
  const whereSql = parts.length ? sql`WHERE ${sql.join(parts, sql` AND `)}` : sql``;

  const countRow: any = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM admin_logs al
    LEFT JOIN users u ON u.id = al.admin_id
    ${whereSql}
  `)).rows?.[0] ?? { count: 0 };

  const rows: any[] = (await db.execute(sql`
    SELECT al.id, al.action, al.target_type, al.target_id, al.details, al.created_at,
           u.id AS admin_user_id, u.name AS admin_name
    FROM admin_logs al
    LEFT JOIN users u ON u.id = al.admin_id
    ${whereSql}
    ORDER BY al.created_at DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `)).rows ?? [];

  res.json({
    page, pageSize, total: Number(countRow.count),
    logs: rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      createdAt: new Date(r.created_at).toISOString(),
      adminId: r.admin_user_id,
      adminName: r.admin_name ?? "Inconnu",
    })),
  });
});

router.get("/admin/verifications", P("verifications", "view"), async (req, res): Promise<void> => {
  const status = (req.query.status as string | undefined) || undefined;
  const level = (req.query.level as string | undefined) || undefined;
  const role = (req.query.role as string | undefined) || undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 30;

  const conds: any[] = [];
  if (status) conds.push(eq(verificationRequestsTable.status, status as any));
  if (level) conds.push(eq(verificationRequestsTable.level, level as any));
  if (role) conds.push(eq(usersTable.role, role as any));

  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: verificationRequestsTable.id,
      userId: verificationRequestsTable.userId,
      status: verificationRequestsTable.status,
      level: verificationRequestsTable.level,
      createdAt: verificationRequestsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userRole: usersTable.role,
    })
    .from(verificationRequestsTable)
    .leftJoin(usersTable, eq(verificationRequestsTable.userId, usersTable.id))
    .where(where as any)
    .orderBy(desc(verificationRequestsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const ids = rows.map(r => r.id);
  const counts = ids.length
    ? await db
        .select({ requestId: verificationDocumentsTable.requestId, c: sql<number>`count(*)::int` })
        .from(verificationDocumentsTable)
        .where(inArray(verificationDocumentsTable.requestId, ids))
        .groupBy(verificationDocumentsTable.requestId)
    : [];
  const countMap = new Map(counts.map(c => [c.requestId, Number(c.c)]));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(verificationRequestsTable)
    .leftJoin(usersTable, eq(verificationRequestsTable.userId, usersTable.id))
    .where(where as any);

  const [{ pendingCount }] = await db
    .select({ pendingCount: sql<number>`count(*)::int` })
    .from(verificationRequestsTable)
    .where(eq(verificationRequestsTable.status, "en_attente"));

  res.json({
    items: rows.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName ?? "",
      userEmail: r.userEmail ?? "",
      userRole: r.userRole ?? "",
      level: r.level,
      status: r.status,
      documentCount: countMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
    })),
    total: Number(total),
    pendingCount: Number(pendingCount),
  });
});

router.get("/admin/verifications/:requestId", P("verifications", "view"), async (req, res): Promise<void> => {
  const id = Number(req.params.requestId);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "id invalide" }); return; }
  const [r] = await db.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, id)).limit(1);
  if (!r) { res.status(404).json({ error: "Demande introuvable" }); return; }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
  const docs = await db.select().from(verificationDocumentsTable).where(eq(verificationDocumentsTable.requestId, r.id));
  res.json({
    request: {
      id: r.id,
      userId: r.userId,
      level: r.level,
      status: r.status,
      rejectionReason: r.rejectionReason ?? null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    },
    documents: docs.map(d => ({
      id: d.id,
      documentType: d.documentType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
    user: u ? {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone ?? null,
      region: u.region ?? null,
      verificationStatus: (u as any).verificationStatus ?? "non_verifie",
      verificationLevel: (u as any).verificationLevel ?? 0,
    } : null,
  });
});

router.put("/admin/verifications/:requestId/approve", P("verifications", "approve"), async (req, res): Promise<void> => {
  const id = Number(req.params.requestId);
  const { level } = req.body ?? {};
  if (level !== "identite" && level !== "professionnel") {
    res.status(400).json({ error: "Niveau invalide" }); return;
  }
  const [r] = await db.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, id)).limit(1);
  if (!r) { res.status(404).json({ error: "Demande introuvable" }); return; }
  if (r.status !== "en_attente") { res.status(400).json({ error: "Demande déjà traitée" }); return; }
  // Cannot grant a higher level than what was requested (with evidence)
  if (level === "professionnel" && r.level !== "professionnel") {
    res.status(400).json({ error: "Impossible d'approuver Pro: la demande est de niveau Identité uniquement" }); return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
  const currentLevel = (targetUser as any)?.verificationLevel ?? 0;
  const newLevel = level === "professionnel" ? 2 : 1;
  // Never downgrade
  if (newLevel < currentLevel) {
    res.status(400).json({ error: "Impossible de rétrograder le niveau actuel de l'utilisateur" }); return;
  }
  const finalLevel = Math.max(currentLevel, newLevel);
  const newStatus = finalLevel >= 2 ? "professionnel_verifie" : "identite_verifie";
  const now = new Date();

  await db.update(verificationRequestsTable)
    .set({ status: "approuvée", reviewedBy: req.auth!.userId, reviewedAt: now, updatedAt: now })
    .where(eq(verificationRequestsTable.id, id));

  await db.update(usersTable)
    .set({ verificationStatus: newStatus, verificationLevel: finalLevel, verifiedAt: now } as any)
    .where(eq(usersTable.id, r.userId));

  await db.insert(notificationsTable).values({
    title: "Vérification approuvée",
    message: `Votre demande de vérification (${level}) a été approuvée. Votre profil affiche désormais le badge officiel.`,
    audience: "all",
    audienceValue: String(r.userId),
    sentBy: req.auth!.userId,
    reach: 1,
  });

  await logAdminAction(req.auth!.userId, "verification_approve", "verification", id, { userId: r.userId, level });
  res.json({ success: true });
});

router.put("/admin/verifications/:requestId/reject", P("verifications", "reject"), async (req, res): Promise<void> => {
  const id = Number(req.params.requestId);
  const { reason } = req.body ?? {};
  if (typeof reason !== "string" || reason.trim().length < 5) {
    res.status(400).json({ error: "Veuillez fournir une raison (min. 5 caractères)" }); return;
  }
  const [r] = await db.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, id)).limit(1);
  if (!r) { res.status(404).json({ error: "Demande introuvable" }); return; }
  if (r.status !== "en_attente") { res.status(400).json({ error: "Demande déjà traitée" }); return; }

  const now = new Date();
  await db.update(verificationRequestsTable)
    .set({ status: "rejetée", rejectionReason: reason.trim(), reviewedBy: req.auth!.userId, reviewedAt: now, updatedAt: now })
    .where(eq(verificationRequestsTable.id, id));

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
  const lvl = (u as any)?.verificationLevel ?? 0;
  const newStatus = lvl >= 2 ? "professionnel_verifie" : lvl === 1 ? "identite_verifie" : "non_verifie";
  await db.update(usersTable).set({ verificationStatus: newStatus } as any).where(eq(usersTable.id, r.userId));

  await db.insert(notificationsTable).values({
    title: "Vérification refusée",
    message: `Votre demande de vérification a été refusée. Motif: ${reason.trim()}`,
    audience: "all",
    audienceValue: String(r.userId),
    sentBy: req.auth!.userId,
    reach: 1,
  });

  await logAdminAction(req.auth!.userId, "verification_reject", "verification", id, { userId: r.userId, reason: reason.trim() });
  res.json({ success: true });
});

// ─── FINANCE METRICS ──────────────────────────────────────────────────────────
// MRR series + churn + LTV per segment + linear forecast.
router.get("/admin/finance/metrics", P("subscriptions", "view"), async (req, res): Promise<void> => {
  const monthsRaw = Number(req.query.months ?? 12);
  const months = Math.min(24, Math.max(3, Number.isFinite(monthsRaw) ? Math.floor(monthsRaw) : 12));
  const forecastMonths = 3;

  // Build the trailing N month buckets (inclusive of current month) as YYYY-MM strings.
  const now = new Date();
  const buckets: { key: string; start: Date; end: Date }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    buckets.push({ key: start.toISOString().slice(0, 7), start, end });
  }

  // ===== MRR per month, broken down by plan =====
  // One paid invoice = 1 month of revenue for the plan, attributed to its period_start month.
  const mrrRows = await db
    .select({
      month: sql<string>`to_char(${subscriptionInvoicesTable.periodStart}, 'YYYY-MM')`,
      planName: subscriptionInvoicesTable.planName,
      total: sql<number>`COALESCE(SUM(${subscriptionInvoicesTable.amountFcfa}), 0)::int`,
    })
    .from(subscriptionInvoicesTable)
    .where(and(
      eq(subscriptionInvoicesTable.status, "payée"),
      gte(subscriptionInvoicesTable.periodStart, buckets[0].start.toISOString().slice(0, 10)),
    ))
    .groupBy(sql`1`, subscriptionInvoicesTable.planName);

  const mrrByMonth = new Map<string, { pro: number; business: number }>();
  for (const r of mrrRows) {
    const m = mrrByMonth.get(r.month) ?? { pro: 0, business: 0 };
    if (r.planName === "pro") m.pro += Number(r.total);
    else if (r.planName === "business") m.business += Number(r.total);
    mrrByMonth.set(r.month, m);
  }
  const mrrSeries = buckets.map(b => {
    const m = mrrByMonth.get(b.key) ?? { pro: 0, business: 0 };
    return { month: b.key, mrr_pro: m.pro, mrr_business: m.business, mrr_total: m.pro + m.business };
  });

  // ===== Churn per month =====
  // active_at_start = subs with started_at < bucket.start AND (cancelled_at is null OR cancelled_at >= bucket.start) AND expires_at >= bucket.start
  // cancelled_in = subs with cancelled_at in [start,end)  +  subs that expired (status='expired' and expires_at in [start,end) and never renewed)
  const churnRows: { month: string; cancelled: number; active_at_start: number }[] = [];
  for (const b of buckets) {
    const startISO = b.start.toISOString();
    const endISO = b.end.toISOString();
    const activeRes: any = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM ${subscriptionsTable}
      WHERE ${subscriptionsTable.startedAt} < ${startISO}
        AND ${subscriptionsTable.expiresAt} >= ${startISO}
        AND (${subscriptionsTable.cancelledAt} IS NULL OR ${subscriptionsTable.cancelledAt} >= ${startISO})
    `);
    const cancelRes: any = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM ${subscriptionsTable}
      WHERE (${subscriptionsTable.cancelledAt} >= ${startISO} AND ${subscriptionsTable.cancelledAt} < ${endISO})
         OR (${subscriptionsTable.status} = 'expired'
             AND ${subscriptionsTable.expiresAt} >= ${startISO}
             AND ${subscriptionsTable.expiresAt} < ${endISO})
    `);
    const active = Number(activeRes.rows?.[0]?.c ?? 0);
    const cancelled = Number(cancelRes.rows?.[0]?.c ?? 0);
    churnRows.push({
      month: b.key,
      active_at_start: active,
      cancelled,
    });
  }
  const churnSeries = churnRows.map(r => ({
    month: r.month,
    cancelled: r.cancelled,
    active_at_start: r.active_at_start,
    churn_rate: r.active_at_start > 0 ? r.cancelled / r.active_at_start : 0,
  }));

  // ===== Forecast (linear regression over last 6 months of MRR) =====
  const last6 = mrrSeries.slice(-6);
  const xs = last6.map((_, i) => i);
  const ys = last6.map(p => p.mrr_total);
  const n = xs.length || 1;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const forecast: { month: string; mrr_total: number }[] = [];
  for (let i = 1; i <= forecastMonths; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const projected = Math.max(0, Math.round(intercept + slope * (xs.length - 1 + i)));
    forecast.push({ month: d.toISOString().slice(0, 7), mrr_total: projected });
  }

  // ===== Per-segment snapshot (current state) =====
  const planRows = await db.select().from(plansTable);
  const planById = new Map(planRows.map(p => [p.id, p]));

  const activeBySegment = await db
    .select({
      planId: subscriptionsTable.planId,
      activeCount: sql<number>`count(*)::int`,
    })
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.status, "active"), sql`${subscriptionsTable.expiresAt} > NOW()`))
    .groupBy(subscriptionsTable.planId);

  // Average monthly churn rate (last 3 months) — used as 1/lifetime estimate.
  const recentChurn = churnSeries.slice(-3);
  const avgChurn = recentChurn.length > 0
    ? recentChurn.reduce((a, c) => a + c.churn_rate, 0) / recentChurn.length
    : 0;

  function buildSegment(planName: "pro" | "business") {
    const plan = planRows.find(p => p.name === planName);
    const active = Number(activeBySegment.find(s => plan && s.planId === plan.id)?.activeCount ?? 0);
    const arpu = plan ? plan.priceFcfa : 0; // monthly price = ARPU per active subscriber
    const mrr = active * arpu;
    // LTV = ARPU / monthly churn. If churn is 0 or unknown, cap lifetime at 24 months.
    const lifetimeMonths = avgChurn > 0 ? Math.min(60, 1 / avgChurn) : 24;
    const ltv = Math.round(arpu * lifetimeMonths);
    return { active, mrr, arpu, ltv, lifetime_months: Math.round(lifetimeMonths * 10) / 10 };
  }

  const segments = {
    pro: buildSegment("pro"),
    business: buildSegment("business"),
  };

  // Month-over-month MRR growth (current vs previous full month).
  const last = mrrSeries[mrrSeries.length - 1];
  const prev = mrrSeries[mrrSeries.length - 2];
  const mom = prev && prev.mrr_total > 0
    ? (last.mrr_total - prev.mrr_total) / prev.mrr_total
    : 0;

  void planById;
  res.json({
    months,
    mrr_series: mrrSeries,
    forecast,
    churn_series: churnSeries,
    segments,
    summary: {
      mrr_current: last?.mrr_total ?? 0,
      mrr_previous: prev?.mrr_total ?? 0,
      mrr_mom_growth: mom,
      avg_churn_rate: avgChurn,
      total_active: segments.pro.active + segments.business.active,
      total_ltv_weighted:
        segments.pro.active + segments.business.active > 0
          ? Math.round(
              (segments.pro.ltv * segments.pro.active + segments.business.ltv * segments.business.active) /
              (segments.pro.active + segments.business.active),
            )
          : 0,
    },
  });
});

export default router;
