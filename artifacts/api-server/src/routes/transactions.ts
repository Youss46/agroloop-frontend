import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transactionsTable, residusTable, usersTable, devisTable, ordersTable } from "@workspace/db";
import { generateContractForTransaction } from "../lib/contracts";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";
import {
  CreateTransactionBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

async function notifyTransactionParties(txId: number, type: "transaction_confirmee" | "transaction_annulee") {
  const [row] = await db
    .select({
      id: transactionsTable.id,
      buyerId: transactionsTable.buyerId,
      sellerId: transactionsTable.sellerId,
      quantityKg: transactionsTable.quantityKg,
      totalFcfa: transactionsTable.totalFcfa,
      typeResidu: residusTable.typeResidu,
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .where(eq(transactionsTable.id, txId));
  if (!row) return;
  const tr = row.typeResidu ?? "résidu";
  if (type === "transaction_confirmee") {
    const title = "Transaction confirmée ✓";
    const body = `${tr} · ${row.quantityKg}kg · ${row.totalFcfa} FCFA`;
    const link = `/dashboard/transformateur`;
    await createNotification({ userId: row.buyerId, type, title, body, link: `/dashboard/transformateur` });
    await createNotification({ userId: row.sellerId, type, title, body, link: `/dashboard/producteur` });
  } else {
    const title = "Transaction annulée";
    const body = `La transaction pour ${tr} a été annulée`;
    await createNotification({ userId: row.buyerId, type, title, body, link: `/dashboard/transformateur` });
    await createNotification({ userId: row.sellerId, type, title, body, link: `/dashboard/producteur` });
  }
}

const router: IRouter = Router();

router.post("/transactions", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { residuId, quantityKg } = parsed.data;
  const buyerId = req.auth!.userId;

  const [residu] = await db.select().from(residusTable).where(
    and(eq(residusTable.id, residuId), eq(residusTable.status, "disponible"))
  );

  if (!residu) {
    res.status(400).json({ error: "Offre indisponible ou introuvable" });
    return;
  }

  if (quantityKg > residu.quantityKg) {
    res.status(400).json({ error: "Quantité demandée supérieure à la quantité disponible" });
    return;
  }

  const totalFcfa = Math.round((quantityKg / residu.quantityKg) * residu.priceFcfa);

  const [transaction] = await db.insert(transactionsTable).values({
    residuId,
    buyerId,
    sellerId: residu.userId,
    quantityKg,
    totalFcfa,
    status: "en_attente",
    source: "directe",
  }).returning();

  res.status(201).json({
    ...transaction,
    createdAt: transaction.createdAt.toISOString(),
  });
});

router.get("/transactions/mes-achats", requireAuth, async (req, res): Promise<void> => {
  const buyerId = req.auth!.userId;

  const rows = await db
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
    .where(eq(transactionsTable.buyerId, buyerId))
    .orderBy(transactionsTable.createdAt);

  const buyerRows = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, buyerId));
  const buyerName = buyerRows[0]?.name ?? "Inconnu";

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    typeResidu: r.typeResidu ?? "Inconnu",
    region: r.region ?? "Inconnu",
    sellerName: r.sellerName ?? "Inconnu",
    buyerName,
  })));
});

router.get("/transactions/mes-ventes", requireAuth, async (req, res): Promise<void> => {
  const sellerId = req.auth!.userId;

  const rows = await db
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
      buyerName: usersTable.name,
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .leftJoin(usersTable, eq(transactionsTable.buyerId, usersTable.id))
    .where(eq(transactionsTable.sellerId, sellerId))
    .orderBy(transactionsTable.createdAt);

  const sellerRows = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, sellerId));
  const sellerName = sellerRows[0]?.name ?? "Inconnu";

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    typeResidu: r.typeResidu ?? "Inconnu",
    region: r.region ?? "Inconnu",
    buyerName: r.buyerName ?? "Inconnu",
    sellerName,
  })));
});

// Unified history — all confirmed transactions where user is buyer or seller
router.get("/transactions/historique", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const buyerUser = alias(usersTable, "buyer_user");
  const sellerUser = alias(usersTable, "seller_user");

  const rows = await db
    .select({
      id: transactionsTable.id,
      residuId: transactionsTable.residuId,
      buyerId: transactionsTable.buyerId,
      sellerId: transactionsTable.sellerId,
      quantityKg: transactionsTable.quantityKg,
      totalFcfa: transactionsTable.totalFcfa,
      status: transactionsTable.status,
      source: transactionsTable.source,
      devisId: transactionsTable.devisId,
      orderId: transactionsTable.orderId,
      orderItemId: transactionsTable.orderItemId,
      createdAt: transactionsTable.createdAt,
      typeResidu: residusTable.typeResidu,
      region: residusTable.region,
      buyerName: buyerUser.name,
      sellerName: sellerUser.name,
      devisReference: devisTable.reference,
      orderReference: ordersTable.reference,
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .leftJoin(buyerUser, eq(transactionsTable.buyerId, buyerUser.id))
    .leftJoin(sellerUser, eq(transactionsTable.sellerId, sellerUser.id))
    .leftJoin(devisTable, eq(transactionsTable.devisId, devisTable.id))
    .leftJoin(ordersTable, eq(transactionsTable.orderId, ordersTable.id))
    .where(and(
      eq(transactionsTable.status, "confirmée"),
      or(eq(transactionsTable.buyerId, userId), eq(transactionsTable.sellerId, userId)),
    ))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    typeResidu: r.typeResidu ?? "Inconnu",
    region: r.region ?? "Inconnu",
    buyerName: r.buyerName ?? "Inconnu",
    sellerName: r.sellerName ?? "Inconnu",
    role: r.buyerId === userId ? "acheteur" : "vendeur",
  })));
});

router.get("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;
  const [row] = await db
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
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .where(eq(transactionsTable.id, id));
  if (!row) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  if (row.buyerId !== userId && row.sellerId !== userId) {
    const [me] = await db.select({ role: usersTable.role, isAdminActive: usersTable.isAdminActive }).from(usersTable).where(eq(usersTable.id, userId));
    if (!me || !isAdminRole(me.role) || me.isAdminActive === false) { res.status(403).json({ error: "Accès refusé" }); return; }
  }
  const [seller] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.sellerId));
  const [buyer]  = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.buyerId));
  res.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    sellerName: seller?.name ?? "?",
    buyerName: buyer?.name ?? "?",
  });
});

router.put("/transactions/:id/confirm", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const userId = req.auth!.userId;

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
  if (!tx) {
    res.status(404).json({ error: "Transaction introuvable" });
    return;
  }
  if (tx.sellerId !== userId) {
    res.status(403).json({ error: "Seul le vendeur peut confirmer la transaction" });
    return;
  }
  if (tx.status !== "en_attente") {
    res.status(400).json({ error: `Transaction déjà ${tx.status}` });
    return;
  }

  const [updated] = await db.update(transactionsTable)
    .set({ status: "confirmée" })
    .where(eq(transactionsTable.id, id))
    .returning();

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  });

  notifyTransactionParties(id, "transaction_confirmee").catch(() => undefined);

  // Generate contract PDF + notify both parties
  generateContractForTransaction({ transactionId: id })
    .then(async (c) => {
      const fmt = new Intl.NumberFormat("fr-FR");
      const body = `Référence ${c.reference} · ${fmt.format(updated.quantityKg)} kg · ${fmt.format(updated.totalFcfa)} FCFA`;
      await Promise.all([
        createNotification({
          userId: updated.sellerId,
          type: "transaction_confirmee",
          title: "📄 Votre bon de commande est disponible",
          body,
          link: `/transactions/${id}`,
        }),
        createNotification({
          userId: updated.buyerId,
          type: "transaction_confirmee",
          title: "📄 Votre bon de commande est disponible",
          body,
          link: `/transactions/${id}`,
        }),
      ]);
    })
    .catch((err) => { logger.error({ err: err?.stack || String(err) }, "Contract generation failed"); });
});

router.put("/transactions/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  if (tx.buyerId !== userId && tx.sellerId !== userId) {
    res.status(403).json({ error: "Vous n'êtes pas partie à cette transaction" });
    return;
  }
  if (tx.status !== "en_attente") {
    res.status(400).json({ error: `Transaction déjà ${tx.status}` });
    return;
  }

  const [updated] = await db.update(transactionsTable)
    .set({ status: "annulée" as any })
    .where(eq(transactionsTable.id, id))
    .returning();

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });

  notifyTransactionParties(id, "transaction_annulee").catch(() => undefined);
});

export default router;
