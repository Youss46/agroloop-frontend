import { Router, type IRouter } from "express";
import { sql, eq, count, sum, and, inArray, gt, lt, lte } from "drizzle-orm";
import { db, residusTable, usersTable, transactionsTable, devisTable, cartItemsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [totalKgResult] = await db
    .select({ total: sum(residusTable.quantityKg) })
    .from(residusTable)
    .where(eq(residusTable.status, "vendu"));

  const [usersResult] = await db
    .select({ total: count() })
    .from(usersTable);

  const [offresResult] = await db
    .select({ total: count() })
    .from(residusTable)
    .where(eq(residusTable.status, "disponible"));

  const [transactionsResult] = await db
    .select({ total: count() })
    .from(transactionsTable);

  const totalKg = Number(totalKgResult?.total ?? 0);
  const co2Evite = totalKg * 0.5;

  res.json({
    totalKgValorise: totalKg,
    totalUtilisateurs: Number(usersResult?.total ?? 0),
    co2Evite,
    totalOffres: Number(offresResult?.total ?? 0),
    totalTransactions: Number(transactionsResult?.total ?? 0),
  });
});

router.get("/dashboard/producteur", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;

  const offres = await db
    .select()
    .from(residusTable)
    .where(eq(residusTable.userId, userId))
    .orderBy(residusTable.createdAt);

  const totalKgOffert = offres.reduce((sum, o) => sum + o.quantityKg, 0);
  const offresVendues = offres.filter(o => o.status === "vendu");
  const offresActives = offres.filter(o => o.status === "disponible");

  const ventesData = await db
    .select({ total: sum(transactionsTable.totalFcfa) })
    .from(transactionsTable)
    .where(eq(transactionsTable.sellerId, userId));

  const totalFcfaGagne = Number(ventesData[0]?.total ?? 0);

  const recentOffres = offres.slice(-5).reverse().map(o => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
  }));

  res.json({
    totalKgOffert,
    totalFcfaGagne,
    offresActives: offresActives.length,
    offresVendues: offresVendues.length,
    recentOffres,
  });
});

router.get("/dashboard/transformateur", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;

  const [totalAchatsResult] = await db
    .select({
      totalKg: sum(transactionsTable.quantityKg),
      totalFcfa: sum(transactionsTable.totalFcfa),
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.buyerId, userId));

  const transactions = await db
    .select({
      id: transactionsTable.id,
      residuId: transactionsTable.residuId,
      buyerId: transactionsTable.buyerId,
      sellerId: transactionsTable.sellerId,
      quantityKg: transactionsTable.quantityKg,
      totalFcfa: transactionsTable.totalFcfa,
      status: transactionsTable.status,
      createdAt: transactionsTable.createdAt,
      typeResidu: residusTable.typeResidu,
      region: residusTable.region,
      sellerName: usersTable.name,
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .leftJoin(usersTable, eq(transactionsTable.sellerId, usersTable.id))
    .where(eq(transactionsTable.buyerId, userId))
    .orderBy(transactionsTable.createdAt);

  const buyerRows = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const buyerName = buyerRows[0]?.name ?? "Inconnu";

  const transactionsEnCours = transactions.filter(t => t.status === "en_attente").length;
  const transactionsConfirmees = transactions.filter(t => t.status === "confirmée").length;
  const recentTransactions = transactions.slice(-5).reverse().map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    typeResidu: t.typeResidu ?? "Inconnu",
    region: t.region ?? "Inconnu",
    sellerName: t.sellerName ?? "Inconnu",
    buyerName,
  }));

  res.json({
    totalKgAchete: Number(totalAchatsResult?.totalKg ?? 0),
    totalFcfaDepense: Number(totalAchatsResult?.totalFcfa ?? 0),
    transactionsEnCours,
    transactionsConfirmees,
    recentTransactions,
  });
});

// Unified pending counts for dashboard widget
router.get("/dashboard/pending-counts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!me) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  if (me.role === "transformateur") {
    const [cartRow] = await db.select({ c: count() }).from(cartItemsTable).where(eq(cartItemsTable.userId, userId));
    const [devisRow] = await db.select({ c: count() }).from(devisTable).where(and(
      eq(devisTable.transformateurId, userId),
      inArray(devisTable.status, ["en_attente"]),
    ));
    const [counterRow] = await db.select({ c: count() }).from(devisTable).where(and(
      eq(devisTable.transformateurId, userId),
      eq(devisTable.status, "contre_proposé"),
    ));
    const [orderItemsPendingRow] = await db.select({ c: count() })
      .from(orderItemsTable)
      .leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(and(
        eq(ordersTable.transformateurId, userId),
        eq(orderItemsTable.status, "en_attente"),
      ));
    const [orderCounterRow] = await db.select({ c: count() })
      .from(orderItemsTable)
      .leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(and(
        eq(ordersTable.transformateurId, userId),
        eq(orderItemsTable.status, "contre_proposée"),
      ));

    res.json({
      role: "transformateur",
      cartCount: Number(cartRow?.c ?? 0),
      devisPending: Number(devisRow?.c ?? 0),
      counterProposalsDevis: Number(counterRow?.c ?? 0),
      counterProposalsCommandes: Number(orderCounterRow?.c ?? 0),
      ordersInProgress: Number(orderItemsPendingRow?.c ?? 0),
    });
    return;
  }

  // producteur
  const in6h = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const now = new Date();

  const [devisReceivedRow] = await db.select({ c: count() }).from(devisTable).where(and(
    eq(devisTable.producteurId, userId),
    eq(devisTable.status, "en_attente"),
  ));
  const [orderReceivedRow] = await db.select({ c: count() }).from(orderItemsTable).where(and(
    eq(orderItemsTable.producteurId, userId),
    eq(orderItemsTable.status, "en_attente"),
  ));

  // Expiring soon (< 6h)
  const [devisExpSoonRow] = await db.select({ c: count() }).from(devisTable).where(and(
    eq(devisTable.producteurId, userId),
    inArray(devisTable.status, ["en_attente", "contre_proposé"]),
    gt(devisTable.expiresAt, now),
    lte(devisTable.expiresAt, in6h),
  ));
  // Orders: order_items expire 48h after creation
  const orderExpiryThreshold = new Date(Date.now() - (48 - 6) * 60 * 60 * 1000); // older than 42h
  const [ordersExpSoonRow] = await db.select({ c: count() }).from(orderItemsTable).where(and(
    eq(orderItemsTable.producteurId, userId),
    inArray(orderItemsTable.status, ["en_attente", "contre_proposée"]),
    lt(orderItemsTable.createdAt, orderExpiryThreshold),
  ));

  res.json({
    role: "producteur",
    devisReceived: Number(devisReceivedRow?.c ?? 0),
    ordersReceived: Number(orderReceivedRow?.c ?? 0),
    expiringSoonDevis: Number(devisExpSoonRow?.c ?? 0),
    expiringSoonCommandes: Number(ordersExpSoonRow?.c ?? 0),
  });
});

// Per-offer buyer state — for marketplace cards (transformateur only)
router.get("/offres/buyer-states", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!me || me.role !== "transformateur") { res.json({}); return; }

  const cartItems = await db.select({ offreId: cartItemsTable.offreId })
    .from(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  const activeDevis = await db.select({ offreId: devisTable.offreId, reference: devisTable.reference, id: devisTable.id })
    .from(devisTable).where(and(
      eq(devisTable.transformateurId, userId),
      inArray(devisTable.status, ["en_attente", "contre_proposé"]),
    ));
  const activeOrderItems = await db
    .select({ offreId: orderItemsTable.offreId, orderId: orderItemsTable.orderId })
    .from(orderItemsTable)
    .leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(
      eq(ordersTable.transformateurId, userId),
      inArray(orderItemsTable.status, ["en_attente", "contre_proposée"]),
    ));

  const map: Record<number, { inCart: boolean; activeDevisId?: number; activeOrderId?: number }> = {};
  for (const c of cartItems) {
    map[c.offreId] = { ...(map[c.offreId] ?? { inCart: false }), inCart: true };
  }
  for (const d of activeDevis) {
    map[d.offreId] = { ...(map[d.offreId] ?? { inCart: false }), activeDevisId: d.id };
  }
  for (const o of activeOrderItems) {
    if (o.orderId == null) continue;
    map[o.offreId] = { ...(map[o.offreId] ?? { inCart: false }), activeOrderId: o.orderId };
  }
  res.json(map);
});

export default router;
