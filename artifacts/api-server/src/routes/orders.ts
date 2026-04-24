import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, sql, gte } from "drizzle-orm";
import {
  db, cartItemsTable, ordersTable, orderItemsTable, residusTable,
  usersTable, transactionsTable, offerPhotosTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { generateContractForTransaction } from "../lib/contracts";
import { generateUniqueOrderReference } from "../lib/orders";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

function serializeOrderItem(oi: typeof orderItemsTable.$inferSelect) {
  return {
    id: oi.id,
    order_id: oi.orderId,
    offre_id: oi.offreId,
    producteur_id: oi.producteurId,
    quantity_kg: oi.quantityKg,
    unit_price_fcfa: oi.unitPriceFcfa,
    total_fcfa: oi.totalFcfa,
    status: oi.status,
    counter_quantity_kg: oi.counterQuantityKg,
    counter_price_fcfa: oi.counterPriceFcfa,
    counter_note: oi.counterNote,
    responded_at: oi.respondedAt?.toISOString() ?? null,
    created_at: oi.createdAt.toISOString(),
  };
}

function serializeOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    transformateur_id: o.transformateurId,
    reference: o.reference,
    status: o.status,
    total_fcfa: o.totalFcfa,
    note_globale: o.noteGlobale,
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  };
}

async function computeOrderStatus(orderId: number): Promise<"en_attente" | "partiellement_confirmée" | "confirmée" | "annulée"> {
  const items = await db.select({ status: orderItemsTable.status }).from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  if (items.length === 0) return "en_attente";
  const pending = items.filter(i => i.status === "en_attente" || i.status === "contre_proposée").length;
  const accepted = items.filter(i => i.status === "acceptée").length;
  const refused = items.filter(i => i.status === "refusée").length;
  if (refused === items.length) return "annulée";
  if (pending === items.length) return "en_attente";
  if (pending === 0) return "confirmée";
  if (accepted > 0) return "partiellement_confirmée";
  return "en_attente";
}

async function recomputeAndSaveOrderStatus(orderId: number): Promise<void> {
  const newStatus = await computeOrderStatus(orderId);
  await db.update(ordersTable).set({ status: newStatus, updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
}

// ============ POST /api/orders ═════════════════════════════════════════════
router.post("/orders", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const noteGlobale = typeof req.body?.note_globale === "string" ? req.body.note_globale.trim().slice(0, 1000) : null;

  const cartItems = await db
    .select({ ci: cartItemsTable, offer: residusTable })
    .from(cartItemsTable)
    .leftJoin(residusTable, eq(cartItemsTable.offreId, residusTable.id))
    .where(eq(cartItemsTable.userId, userId));

  if (cartItems.length === 0) { res.status(400).json({ error: "Votre panier est vide" }); return; }

  // Validate all offers still available + sufficient stock
  for (const { ci, offer } of cartItems) {
    if (!offer) { res.status(400).json({ error: `Offre #${ci.offreId} introuvable` }); return; }
    if (offer.status !== "disponible") {
      res.status(400).json({ error: `L'offre "${offer.typeResidu}" n'est plus disponible`, offre_id: offer.id }); return;
    }
    if (ci.quantityKg > offer.quantityKg) {
      res.status(400).json({ error: `Stock insuffisant pour "${offer.typeResidu}" (${offer.quantityKg}kg disponible)`, offre_id: offer.id }); return;
    }
  }

  const totalFcfa = cartItems.reduce((sum, { ci, offer }) => sum + ci.quantityKg * (offer?.priceFcfa ?? 0), 0);
  const reference = await generateUniqueOrderReference();

  let orderId = 0;
  await db.transaction(async (tx) => {
    const [order] = await tx.insert(ordersTable).values({
      transformateurId: userId,
      reference,
      status: "en_attente",
      totalFcfa,
      noteGlobale,
    }).returning();
    orderId = order.id;

    await tx.insert(orderItemsTable).values(cartItems.map(({ ci, offer }) => ({
      orderId: order.id,
      offreId: ci.offreId,
      producteurId: offer!.userId,
      quantityKg: ci.quantityKg,
      unitPriceFcfa: offer!.priceFcfa,
      totalFcfa: ci.quantityKg * offer!.priceFcfa,
    })));

    await tx.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  });

  // Notify each producteur (grouped by seller)
  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const grouped = new Map<number, typeof cartItems>();
  for (const ci of cartItems) {
    if (!ci.offer) continue;
    const arr = grouped.get(ci.offer.userId) ?? [];
    arr.push(ci);
    grouped.set(ci.offer.userId, arr);
  }

  // Need new order_items to get their IDs for the notification links
  const createdItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const itemByOffreId = new Map(createdItems.map(i => [i.offreId, i]));

  for (const [sellerId, items] of grouped.entries()) {
    if (items.length === 1 && items[0].offer) {
      const oi = itemByOffreId.get(items[0].offer.id);
      await createNotification({
        userId: sellerId,
        type: "offre_correspondante",
        title: "📦 Nouvelle commande reçue",
        body: `${FCFA(items[0].ci.quantityKg)}kg de ${items[0].offer.typeResidu} demandés par ${buyer?.name ?? "un acheteur"}`,
        link: oi ? `/commandes/recues` : `/commandes/recues`,
      }).catch(() => undefined);
    } else {
      await createNotification({
        userId: sellerId,
        type: "offre_correspondante",
        title: "📦 Nouvelle commande reçue",
        body: `${items.length} articles demandés par ${buyer?.name ?? "un acheteur"}`,
        link: `/commandes/recues`,
      }).catch(() => undefined);
    }
  }

  const [finalOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  res.status(201).json({ ...serializeOrder(finalOrder), items: createdItems.map(serializeOrderItem) });
});

// ============ GET /api/orders — transformateur: my orders ═════════════════
router.get("/orders", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const statusFilter = typeof req.query.status === "string" && req.query.status !== "tous" ? String(req.query.status) : undefined;

  const conditions = [eq(ordersTable.transformateurId, userId)];
  if (statusFilter) conditions.push(eq(ordersTable.status, statusFilter as any));

  const orders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt));

  const orderIds = orders.map(o => o.id);
  const items = orderIds.length ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : [];

  const itemsByOrder = new Map<number, typeof items>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  res.json(orders.map(o => {
    const ois = itemsByOrder.get(o.id) ?? [];
    return {
      ...serializeOrder(o),
      items_count: ois.length,
      sellers_count: new Set(ois.map(i => i.producteurId)).size,
      pending_count: ois.filter(i => i.status === "en_attente").length,
    };
  }));
});

// ============ GET /api/orders/received — producteur: received ══════════════
router.get("/orders/received", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const statusFilter = typeof req.query.status === "string" && req.query.status !== "tous" ? String(req.query.status) : undefined;

  const conditions = [eq(orderItemsTable.producteurId, userId)];
  if (statusFilter) conditions.push(eq(orderItemsTable.status, statusFilter as any));

  const rows = await db
    .select({
      oi: orderItemsTable,
      order: ordersTable,
      offerTypeResidu: residusTable.typeResidu,
      offerRegion: residusTable.region,
    })
    .from(orderItemsTable)
    .leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .leftJoin(residusTable, eq(orderItemsTable.offreId, residusTable.id))
    .where(and(...conditions))
    .orderBy(desc(orderItemsTable.createdAt));

  const buyerIds = Array.from(new Set(rows.map(r => r.order?.transformateurId).filter((x): x is number => !!x)));
  const buyers = buyerIds.length ? await db
    .select({ id: usersTable.id, name: usersTable.name, verificationLevel: usersTable.verificationLevel })
    .from(usersTable).where(inArray(usersTable.id, buyerIds)) : [];
  const buyerMap = new Map(buyers.map(b => [b.id, b]));

  // Cover photos
  const offerIds = Array.from(new Set(rows.map(r => r.oi.offreId)));
  const covers = offerIds.length ? await db
    .select({ offreId: offerPhotosTable.offreId, thumbnailUrl: offerPhotosTable.thumbnailUrl, isCover: offerPhotosTable.isCover })
    .from(offerPhotosTable).where(inArray(offerPhotosTable.offreId, offerIds)) : [];
  const coverMap = new Map<number, string>();
  for (const c of covers) {
    const ex = coverMap.get(c.offreId);
    if (!ex || c.isCover) coverMap.set(c.offreId, c.thumbnailUrl);
  }

  res.json(rows.map(r => ({
    ...serializeOrderItem(r.oi),
    order: r.order ? { id: r.order.id, reference: r.order.reference, note_globale: r.order.noteGlobale, created_at: r.order.createdAt.toISOString() } : null,
    buyer: r.order ? {
      id: r.order.transformateurId,
      name: buyerMap.get(r.order.transformateurId)?.name ?? "—",
      verification_level: buyerMap.get(r.order.transformateurId)?.verificationLevel ?? 0,
    } : null,
    offer: {
      id: r.oi.offreId,
      type_residu: r.offerTypeResidu ?? "—",
      region: r.offerRegion ?? "—",
      cover_photo_url: coverMap.get(r.oi.offreId) ?? null,
    },
  })));
});

// ============ GET /api/orders/:id — order detail ════════════════════════════
router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }

  // Permission: buyer OR any seller whose item is in the order
  const items = await db
    .select({
      oi: orderItemsTable,
      offerTypeResidu: residusTable.typeResidu,
      offerDescription: residusTable.description,
      offerRegion: residusTable.region,
    })
    .from(orderItemsTable)
    .leftJoin(residusTable, eq(orderItemsTable.offreId, residusTable.id))
    .where(eq(orderItemsTable.orderId, id));

  const isBuyer = order.transformateurId === userId;
  const sellerIds = new Set(items.map(i => i.oi.producteurId));
  const isSeller = sellerIds.has(userId);
  if (!isBuyer && !isSeller) { res.status(403).json({ error: "Accès refusé" }); return; }

  const allSellerIds = Array.from(sellerIds);
  const sellers = allSellerIds.length ? await db
    .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, verificationLevel: usersTable.verificationLevel, region: usersTable.region })
    .from(usersTable).where(inArray(usersTable.id, allSellerIds)) : [];
  const sellerMap = new Map(sellers.map(s => [s.id, s]));

  const [buyer] = await db
    .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, verificationLevel: usersTable.verificationLevel })
    .from(usersTable).where(eq(usersTable.id, order.transformateurId));

  // Cover photos
  const offerIds = Array.from(new Set(items.map(i => i.oi.offreId)));
  const covers = offerIds.length ? await db
    .select({ offreId: offerPhotosTable.offreId, thumbnailUrl: offerPhotosTable.thumbnailUrl, isCover: offerPhotosTable.isCover })
    .from(offerPhotosTable).where(inArray(offerPhotosTable.offreId, offerIds)) : [];
  const coverMap = new Map<number, string>();
  for (const c of covers) {
    const ex = coverMap.get(c.offreId);
    if (!ex || c.isCover) coverMap.set(c.offreId, c.thumbnailUrl);
  }

  // If seller viewing, filter items to only theirs
  const visibleItems = isBuyer ? items : items.filter(i => i.oi.producteurId === userId);

  res.json({
    ...serializeOrder(order),
    buyer: buyer ?? null,
    items: visibleItems.map(i => ({
      ...serializeOrderItem(i.oi),
      offer: {
        id: i.oi.offreId,
        type_residu: i.offerTypeResidu ?? "—",
        description: i.offerDescription ?? null,
        region: i.offerRegion ?? "—",
        cover_photo_url: coverMap.get(i.oi.offreId) ?? null,
      },
      producteur: sellerMap.get(i.oi.producteurId) ?? null,
    })),
  });
});

// ─── Helpers for respond ──────────────────────────────────────────────────
async function atomicallyAcceptOrderItem(params: {
  itemId: number;
  expectedStatus: "en_attente" | "contre_proposée";
  offreId: number;
  buyerId: number;
  sellerId: number;
  quantityKg: number;
  unitPriceFcfa: number;
  totalFcfa: number;
}): Promise<{ transactionId: number; orderId: number }> {
  let txId = 0;
  let orderId = 0;
  await db.transaction(async (tx) => {
    // CAS update item
    const transitioned = await tx.update(orderItemsTable).set({
      status: "acceptée",
      respondedAt: new Date(),
    }).where(and(
      eq(orderItemsTable.id, params.itemId),
      eq(orderItemsTable.status, params.expectedStatus),
    )).returning();
    if (transitioned.length === 0) {
      throw new Error("ITEM_STATE_CHANGED");
    }
    orderId = transitioned[0].orderId;

    // Conditional stock decrement
    const stockUpdate = await tx.update(residusTable).set({
      quantityKg: sql`${residusTable.quantityKg} - ${params.quantityKg}`,
      status: sql`CASE WHEN ${residusTable.quantityKg} - ${params.quantityKg} = 0 THEN 'vendu' ELSE ${residusTable.status} END`,
    }).where(and(
      eq(residusTable.id, params.offreId),
      gte(residusTable.quantityKg, params.quantityKg),
    )).returning({ id: residusTable.id });
    if (stockUpdate.length === 0) {
      throw new Error("OFFER_STOCK_INSUFFICIENT");
    }

    // Create transaction
    const [trx] = await tx.insert(transactionsTable).values({
      residuId: params.offreId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      quantityKg: params.quantityKg,
      totalFcfa: params.totalFcfa,
      status: "confirmée",
      source: "commande",
      orderId: transitioned[0].orderId,
      orderItemId: params.itemId,
    }).returning();
    txId = trx.id;
  });

  generateContractForTransaction({ transactionId: txId }).catch((err) => {
    logger.error({ err: err?.stack || String(err), txId }, "Order item contract generation failed");
  });

  return { transactionId: txId, orderId };
}

// ============ PUT /api/orders/items/:itemId/respond — producteur ═══════════
router.put("/orders/items/:itemId/respond", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const itemId = Number(req.params.itemId);
  if (!Number.isFinite(itemId)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;
  const action = req.body?.action;

  const [item] = await db.select().from(orderItemsTable).where(eq(orderItemsTable.id, itemId));
  if (!item) { res.status(404).json({ error: "Article de commande introuvable" }); return; }
  if (item.producteurId !== userId) { res.status(403).json({ error: "Seul le vendeur peut répondre à cette demande" }); return; }
  if (item.status !== "en_attente") { res.status(400).json({ error: `Article déjà ${item.status}` }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, item.orderId));
  const [offer] = await db.select().from(residusTable).where(eq(residusTable.id, item.offreId));
  if (!order || !offer) { res.status(404).json({ error: "Ressources introuvables" }); return; }

  const [seller] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  if (action === "accepter") {
    try {
      await atomicallyAcceptOrderItem({
        itemId,
        expectedStatus: "en_attente",
        offreId: item.offreId,
        buyerId: order.transformateurId,
        sellerId: userId,
        quantityKg: item.quantityKg,
        unitPriceFcfa: item.unitPriceFcfa,
        totalFcfa: item.totalFcfa,
      });
    } catch (err: any) {
      if (err?.message === "OFFER_STOCK_INSUFFICIENT") {
        res.status(409).json({ error: "Stock insuffisant sur l'offre" }); return;
      }
      if (err?.message === "ITEM_STATE_CHANGED") {
        res.status(409).json({ error: "Cet article a déjà été traité" }); return;
      }
      throw err;
    }

    createNotification({
      userId: order.transformateurId,
      type: "transaction_confirmee",
      title: "✅ Commande acceptée",
      body: `${seller?.name ?? "Le vendeur"} a accepté votre commande de ${FCFA(item.quantityKg)}kg de ${offer.typeResidu}`,
      link: `/commandes/${order.id}`,
    }).catch(() => undefined);
  } else if (action === "refuser") {
    const counterNote = typeof req.body?.counter_note === "string" ? req.body.counter_note.trim().slice(0, 500) : "";
    await db.update(orderItemsTable).set({
      status: "refusée",
      counterNote: counterNote || null,
      respondedAt: new Date(),
    }).where(eq(orderItemsTable.id, itemId));

    createNotification({
      userId: order.transformateurId,
      type: "transaction_annulee",
      title: "❌ Commande refusée",
      body: counterNote
        ? `${seller?.name ?? "Le vendeur"} a refusé votre commande. Motif : ${counterNote}`
        : `${seller?.name ?? "Le vendeur"} a refusé votre commande`,
      link: `/commandes/${order.id}`,
    }).catch(() => undefined);
  } else if (action === "contre_proposer") {
    const counterQuantityKg = Number(req.body?.counter_quantity_kg);
    const counterPriceFcfa = Number(req.body?.counter_price_fcfa);
    const counterNote = typeof req.body?.counter_note === "string" ? req.body.counter_note.trim().slice(0, 500) : null;

    if (!Number.isFinite(counterQuantityKg) || counterQuantityKg <= 0) { res.status(400).json({ error: "Quantité invalide" }); return; }
    if (!Number.isFinite(counterPriceFcfa) || counterPriceFcfa <= 0) { res.status(400).json({ error: "Prix invalide" }); return; }
    if (counterQuantityKg > offer.quantityKg) {
      res.status(400).json({ error: `Quantité supérieure au stock (${offer.quantityKg}kg)` }); return;
    }

    await db.update(orderItemsTable).set({
      status: "contre_proposée",
      counterQuantityKg,
      counterPriceFcfa,
      counterNote,
      respondedAt: new Date(),
    }).where(eq(orderItemsTable.id, itemId));

    createNotification({
      userId: order.transformateurId,
      type: "offre_correspondante",
      title: "🔄 Contre-proposition reçue",
      body: `${seller?.name ?? "Le vendeur"} propose ${FCFA(counterQuantityKg)}kg à ${FCFA(counterPriceFcfa)} FCFA/kg`,
      link: `/commandes/${order.id}`,
    }).catch(() => undefined);
  } else {
    res.status(400).json({ error: "Action invalide" }); return;
  }

  await recomputeAndSaveOrderStatus(item.orderId);
  const [updatedItem] = await db.select().from(orderItemsTable).where(eq(orderItemsTable.id, itemId));
  res.json(serializeOrderItem(updatedItem));
});

// ============ PUT /api/orders/items/:itemId/counter-respond — transformateur ═
router.put("/orders/items/:itemId/counter-respond", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const itemId = Number(req.params.itemId);
  if (!Number.isFinite(itemId)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;
  const action = req.body?.action;

  const [item] = await db.select().from(orderItemsTable).where(eq(orderItemsTable.id, itemId));
  if (!item) { res.status(404).json({ error: "Article introuvable" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, item.orderId));
  if (!order || order.transformateurId !== userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  if (item.status !== "contre_proposée") { res.status(400).json({ error: "Aucune contre-proposition à traiter" }); return; }
  if (item.counterQuantityKg == null || item.counterPriceFcfa == null) {
    res.status(400).json({ error: "Contre-proposition incomplète" }); return;
  }

  const [offer] = await db.select().from(residusTable).where(eq(residusTable.id, item.offreId));
  if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }

  if (action === "accepter") {
    const counterTotalFcfa = item.counterQuantityKg * item.counterPriceFcfa;
    try {
      await atomicallyAcceptOrderItem({
        itemId,
        expectedStatus: "contre_proposée",
        offreId: item.offreId,
        buyerId: userId,
        sellerId: item.producteurId,
        quantityKg: item.counterQuantityKg,
        unitPriceFcfa: item.counterPriceFcfa,
        totalFcfa: counterTotalFcfa,
      });
    } catch (err: any) {
      if (err?.message === "OFFER_STOCK_INSUFFICIENT") {
        res.status(409).json({ error: "Stock insuffisant sur l'offre" }); return;
      }
      if (err?.message === "ITEM_STATE_CHANGED") {
        res.status(409).json({ error: "Cet article a déjà été traité" }); return;
      }
      throw err;
    }

    // Update item totals to counter values
    await db.update(orderItemsTable).set({
      quantityKg: item.counterQuantityKg,
      unitPriceFcfa: item.counterPriceFcfa,
      totalFcfa: counterTotalFcfa,
    }).where(eq(orderItemsTable.id, itemId));

    const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    createNotification({
      userId: item.producteurId,
      type: "transaction_confirmee",
      title: "✅ Contre-proposition acceptée",
      body: `${buyer?.name ?? "L'acheteur"} a accepté votre contre-proposition pour ${offer.typeResidu}`,
      link: `/commandes/recues`,
    }).catch(() => undefined);
  } else if (action === "refuser") {
    await db.update(orderItemsTable).set({
      status: "refusée",
      respondedAt: new Date(),
    }).where(eq(orderItemsTable.id, itemId));

    const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    createNotification({
      userId: item.producteurId,
      type: "transaction_annulee",
      title: "❌ Contre-proposition refusée",
      body: `${buyer?.name ?? "L'acheteur"} a refusé votre contre-proposition`,
      link: `/commandes/recues`,
    }).catch(() => undefined);
  } else {
    res.status(400).json({ error: "Action invalide" }); return;
  }

  await recomputeAndSaveOrderStatus(item.orderId);
  const [updatedItem] = await db.select().from(orderItemsTable).where(eq(orderItemsTable.id, itemId));
  res.json(serializeOrderItem(updatedItem));
});

export default router;
