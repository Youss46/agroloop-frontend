import { Router, type IRouter } from "express";
import { eq, and, or, desc, inArray, gte, sql } from "drizzle-orm";
import {
  db, devisTable, residusTable, usersTable, transactionsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { generateContractForTransaction } from "../lib/contracts";
import { generateUniqueDevisReference, DEVIS_EXPIRY_MS } from "../lib/devis";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

function serializeDevis(d: typeof devisTable.$inferSelect) {
  return {
    id: d.id,
    offre_id: d.offreId,
    transformateur_id: d.transformateurId,
    producteur_id: d.producteurId,
    reference: d.reference,
    status: d.status,
    quantity_kg: d.quantityKg,
    price_fcfa: d.priceFcfa,
    total_fcfa: d.totalFcfa,
    note: d.note,
    response_note: d.responseNote,
    responded_at: d.respondedAt?.toISOString() ?? null,
    counter_quantity_kg: d.counterQuantityKg,
    counter_price_fcfa: d.counterPriceFcfa,
    counter_total_fcfa: d.counterTotalFcfa,
    counter_note: d.counterNote,
    counter_response_note: d.counterResponseNote,
    counter_responded_at: d.counterRespondedAt?.toISOString() ?? null,
    expires_at: d.expiresAt.toISOString(),
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

// ─── Helper: fetch devis with joined info ──────────────────────────────────
async function fetchDevisListForUser(filterField: "transformateurId" | "producteurId", userId: number, statusFilter?: string) {
  const conditions = [eq(devisTable[filterField], userId)];
  if (statusFilter) conditions.push(eq(devisTable.status, statusFilter as any));

  const rows = await db
    .select({
      d: devisTable,
      offerTypeResidu: residusTable.typeResidu,
      offerRegion: residusTable.region,
      offerPriceFcfa: residusTable.priceFcfa,
      offerQuantityKg: residusTable.quantityKg,
      offerStatus: residusTable.status,
      otherId: filterField === "transformateurId" ? devisTable.producteurId : devisTable.transformateurId,
    })
    .from(devisTable)
    .leftJoin(residusTable, eq(devisTable.offreId, residusTable.id))
    .where(and(...conditions))
    .orderBy(desc(devisTable.createdAt));

  // Fetch other-party names
  const userIds = Array.from(new Set(rows.map(r => r.otherId).filter(Boolean)));
  const users = userIds.length ? await db
    .select({ id: usersTable.id, name: usersTable.name, verificationLevel: usersTable.verificationLevel })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  return rows.map(r => ({
    ...serializeDevis(r.d),
    offre: {
      id: r.d.offreId,
      type_residu: r.offerTypeResidu ?? "—",
      region: r.offerRegion ?? "—",
      seller_price_fcfa: r.offerPriceFcfa ?? 0,
      quantity_kg: r.offerQuantityKg ?? 0,
      status: r.offerStatus ?? null,
    },
    other_party: {
      id: r.otherId,
      name: userMap.get(r.otherId)?.name ?? "—",
      verification_level: userMap.get(r.otherId)?.verificationLevel ?? 0,
    },
  }));
}

// ============ POST /api/devis — transformateur creates quote ═════════════════
router.post("/devis", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const offreId = Number(req.body?.offre_id);
  const quantityKg = Number(req.body?.quantity_kg);
  const priceFcfa = Number(req.body?.price_fcfa);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;

  if (!Number.isFinite(offreId) || offreId <= 0) { res.status(400).json({ error: "ID d'offre invalide" }); return; }
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) { res.status(400).json({ error: "La quantité doit être supérieure à 0" }); return; }
  if (!Number.isFinite(priceFcfa) || priceFcfa <= 0) { res.status(400).json({ error: "Le prix doit être supérieur à 0" }); return; }

  const transformateurId = req.auth!.userId;

  const [offre] = await db.select().from(residusTable).where(eq(residusTable.id, offreId));
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offre.status !== "disponible") { res.status(400).json({ error: "Offre indisponible" }); return; }
  if (offre.userId === transformateurId) { res.status(400).json({ error: "Vous ne pouvez pas faire un devis sur votre propre offre" }); return; }
  if (quantityKg > offre.quantityKg) {
    res.status(400).json({ error: `Quantité supérieure au stock disponible (${offre.quantityKg}kg)` });
    return;
  }

  // No existing active devis from same transformateur on this offre
  const [existing] = await db.select({ id: devisTable.id }).from(devisTable).where(and(
    eq(devisTable.offreId, offreId),
    eq(devisTable.transformateurId, transformateurId),
    or(eq(devisTable.status, "en_attente"), eq(devisTable.status, "contre_proposé")),
  ));
  if (existing) {
    res.status(409).json({ error: "Vous avez déjà un devis actif sur cette offre", devis_id: existing.id });
    return;
  }

  const reference = await generateUniqueDevisReference();
  const totalFcfa = quantityKg * priceFcfa;
  const expiresAt = new Date(Date.now() + DEVIS_EXPIRY_MS);

  let created: typeof devisTable.$inferSelect;
  try {
    [created] = await db.insert(devisTable).values({
      offreId,
      transformateurId,
      producteurId: offre.userId,
      reference,
      quantityKg,
      priceFcfa,
      totalFcfa,
      note,
      expiresAt,
    }).returning();
  } catch (err: any) {
    // Unique-index violation → another concurrent request already created an active devis
    if (err?.code === "23505" && String(err?.constraint ?? "").includes("devis_unique_active_per_offre")) {
      const [existingRow] = await db.select({ id: devisTable.id }).from(devisTable).where(and(
        eq(devisTable.offreId, offreId),
        eq(devisTable.transformateurId, transformateurId),
        or(eq(devisTable.status, "en_attente"), eq(devisTable.status, "contre_proposé")),
      ));
      res.status(409).json({ error: "Vous avez déjà un devis actif sur cette offre", devis_id: existingRow?.id });
      return;
    }
    throw err;
  }

  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, transformateurId));
  createNotification({
    userId: offre.userId,
    type: "offre_correspondante",
    title: "📋 Nouvelle demande de devis",
    body: `${buyer?.name ?? "Un acheteur"} propose ${FCFA(priceFcfa)} FCFA/kg pour ${FCFA(quantityKg)}kg de ${offre.typeResidu}`,
    link: `/devis/${created.id}`,
  }).catch(() => undefined);

  res.status(201).json(serializeDevis(created));
});

// ============ GET /api/devis/mes-devis — transformateur's sent quotes ════════
router.get("/devis/mes-devis", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const statusFilter = typeof req.query.status === "string" && req.query.status !== "tous" ? String(req.query.status) : undefined;
  const list = await fetchDevisListForUser("transformateurId", userId, statusFilter);
  res.json(list);
});

// ============ GET /api/devis/recus — producteur's received quotes ════════════
router.get("/devis/recus", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const statusFilter = typeof req.query.status === "string" && req.query.status !== "tous" ? String(req.query.status) : undefined;
  const list = await fetchDevisListForUser("producteurId", userId, statusFilter);
  res.json(list);
});

// ============ GET /api/devis/:id — detail ════════════════════════════════════
router.get("/devis/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  const [row] = await db
    .select({
      d: devisTable,
      offerTypeResidu: residusTable.typeResidu,
      offerRegion: residusTable.region,
      offerDescription: residusTable.description,
      offerPriceFcfa: residusTable.priceFcfa,
      offerQuantityKg: residusTable.quantityKg,
      offerStatus: residusTable.status,
    })
    .from(devisTable)
    .leftJoin(residusTable, eq(devisTable.offreId, residusTable.id))
    .where(eq(devisTable.id, id));
  if (!row) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (row.d.transformateurId !== userId && row.d.producteurId !== userId) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }

  const [transformateur] = await db.select({
    id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
    verificationLevel: usersTable.verificationLevel,
  }).from(usersTable).where(eq(usersTable.id, row.d.transformateurId));
  const [producteur] = await db.select({
    id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
    verificationLevel: usersTable.verificationLevel,
  }).from(usersTable).where(eq(usersTable.id, row.d.producteurId));

  res.json({
    ...serializeDevis(row.d),
    offre: {
      id: row.d.offreId,
      type_residu: row.offerTypeResidu ?? "—",
      region: row.offerRegion ?? "—",
      description: row.offerDescription ?? null,
      seller_price_fcfa: row.offerPriceFcfa ?? 0,
      quantity_kg: row.offerQuantityKg ?? 0,
      status: row.offerStatus ?? null,
    },
    transformateur: transformateur ?? null,
    producteur: producteur ?? null,
  });
});

// ─── Shared: ensure devis in state that can be acted on ───────────────────
function checkExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}

/**
 * Fully atomic acceptance: transitions devis state with a CAS-style WHERE guard,
 * conditionally decrements offer stock only if >= required qty, and inserts
 * the transaction — all in one DB transaction.
 *
 * Throws:
 *   - DEVIS_STATE_CHANGED: someone else already accepted/refused/expired/countered
 *   - OFFER_STOCK_INSUFFICIENT: stock no longer sufficient
 *   - DEVIS_EXPIRED: devis deadline passed (for en_attente path only)
 */
async function atomicallyAcceptDevis(params: {
  devisId: number;
  expectedStatus: "en_attente" | "contre_proposé";
  newStatus: "accepté" | "contre_proposé_accepté";
  offreId: number;
  buyerId: number;
  sellerId: number;
  quantityKg: number;
  totalFcfa: number;
  checkExpiry: boolean;
  counterResponse?: boolean;
}): Promise<{ transactionId: number }> {
  let txId = 0;
  await db.transaction(async (tx) => {
    // 1) CAS state transition — only succeeds if still in expectedStatus
    //    (and, when relevant, not yet expired)
    const guard = params.checkExpiry
      ? and(
          eq(devisTable.id, params.devisId),
          eq(devisTable.status, params.expectedStatus),
          gte(devisTable.expiresAt, new Date()),
        )
      : and(
          eq(devisTable.id, params.devisId),
          eq(devisTable.status, params.expectedStatus),
        );

    const now = new Date();
    const updateValues: Record<string, any> = {
      status: params.newStatus,
      updatedAt: now,
    };
    if (params.counterResponse) updateValues.counterRespondedAt = now;
    else updateValues.respondedAt = now;

    const transitioned = await tx.update(devisTable).set(updateValues).where(guard).returning();
    if (transitioned.length === 0) {
      // Either already handled, or expired
      const [cur] = await tx.select({ status: devisTable.status, expiresAt: devisTable.expiresAt })
        .from(devisTable).where(eq(devisTable.id, params.devisId));
      if (cur && params.checkExpiry && cur.expiresAt.getTime() < Date.now()) {
        throw new Error("DEVIS_EXPIRED");
      }
      throw new Error("DEVIS_STATE_CHANGED");
    }

    // 2) Conditional stock decrement — only if stock still sufficient
    const stockUpdate = await tx.update(residusTable)
      .set({
        quantityKg: sql`${residusTable.quantityKg} - ${params.quantityKg}`,
        status: sql`CASE WHEN ${residusTable.quantityKg} - ${params.quantityKg} = 0 THEN 'vendu' ELSE ${residusTable.status} END`,
      })
      .where(and(
        eq(residusTable.id, params.offreId),
        gte(residusTable.quantityKg, params.quantityKg),
      ))
      .returning({ id: residusTable.id });
    if (stockUpdate.length === 0) {
      throw new Error("OFFER_STOCK_INSUFFICIENT");
    }

    // 3) Insert transaction
    const [trx] = await tx.insert(transactionsTable).values({
      residuId: params.offreId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      quantityKg: params.quantityKg,
      totalFcfa: params.totalFcfa,
      status: "confirmée",
      source: "devis",
      devisId: params.devisId,
    }).returning();
    txId = trx.id;
  });

  // Contract generation async (non-blocking)
  generateContractForTransaction({ transactionId: txId }).catch((err) => {
    logger.error({ err: err?.stack || String(err), txId }, "Devis contract generation failed");
  });

  return { transactionId: txId };
}

// ============ PUT /api/devis/:id/accepter — producteur accepts ═══════════════
router.put("/devis/:id/accepter", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  const [d] = await db.select().from(devisTable).where(eq(devisTable.id, id));
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.producteurId !== userId) { res.status(403).json({ error: "Seul le vendeur peut accepter ce devis" }); return; }
  if (d.status !== "en_attente") { res.status(400).json({ error: `Devis déjà ${d.status}` }); return; }
  if (checkExpired(d.expiresAt)) { res.status(400).json({ error: "Ce devis a expiré" }); return; }

  try {
    await atomicallyAcceptDevis({
      devisId: id,
      expectedStatus: "en_attente",
      newStatus: "accepté",
      offreId: d.offreId,
      buyerId: d.transformateurId,
      sellerId: d.producteurId,
      quantityKg: d.quantityKg,
      totalFcfa: d.totalFcfa,
      checkExpiry: true,
      counterResponse: false,
    });
  } catch (err: any) {
    if (err?.message === "OFFER_STOCK_INSUFFICIENT") {
      res.status(409).json({ error: "Stock insuffisant sur l'offre" }); return;
    }
    if (err?.message === "DEVIS_EXPIRED") {
      res.status(409).json({ error: "Ce devis a expiré" }); return;
    }
    if (err?.message === "DEVIS_STATE_CHANGED") {
      res.status(409).json({ error: "Ce devis a déjà été traité par ailleurs" }); return;
    }
    throw err;
  }

  const [updated] = await db.select().from(devisTable).where(eq(devisTable.id, id));

  const [offre] = await db.select({ typeResidu: residusTable.typeResidu }).from(residusTable).where(eq(residusTable.id, d.offreId));
  const [seller] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, d.producteurId));
  createNotification({
    userId: d.transformateurId,
    type: "transaction_confirmee",
    title: "✅ Devis accepté !",
    body: `${seller?.name ?? "Le vendeur"} a accepté votre offre de ${FCFA(d.priceFcfa)} FCFA/kg pour ${FCFA(d.quantityKg)}kg de ${offre?.typeResidu ?? "résidu"}`,
    link: `/devis/${id}`,
  }).catch(() => undefined);

  res.json(serializeDevis(updated));
});

// ============ PUT /api/devis/:id/refuser — producteur refuses ════════════════
router.put("/devis/:id/refuser", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;
  const responseNote = typeof req.body?.response_note === "string" ? req.body.response_note.trim().slice(0, 500) : "";

  const [d] = await db.select().from(devisTable).where(eq(devisTable.id, id));
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.producteurId !== userId) { res.status(403).json({ error: "Seul le vendeur peut refuser ce devis" }); return; }
  if (d.status !== "en_attente") { res.status(400).json({ error: `Devis déjà ${d.status}` }); return; }

  const [updated] = await db.update(devisTable).set({
    status: "refusé",
    responseNote: responseNote || null,
    respondedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(devisTable.id, id)).returning();

  createNotification({
    userId: d.transformateurId,
    type: "transaction_annulee",
    title: "❌ Devis refusé",
    body: responseNote ? `Motif : ${responseNote}` : "Le vendeur a refusé votre demande de devis.",
    link: `/devis/${id}`,
  }).catch(() => undefined);

  res.json(serializeDevis(updated));
});

// ============ PUT /api/devis/:id/contre-proposer — producteur counters ═══════
router.put("/devis/:id/contre-proposer", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  const counterQuantityKg = Number(req.body?.counter_quantity_kg);
  const counterPriceFcfa = Number(req.body?.counter_price_fcfa);
  const counterNote = typeof req.body?.counter_note === "string" ? req.body.counter_note.trim().slice(0, 500) : null;

  if (!Number.isFinite(counterQuantityKg) || counterQuantityKg <= 0) { res.status(400).json({ error: "Quantité invalide" }); return; }
  if (!Number.isFinite(counterPriceFcfa) || counterPriceFcfa <= 0) { res.status(400).json({ error: "Prix invalide" }); return; }

  const [d] = await db.select().from(devisTable).where(eq(devisTable.id, id));
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.producteurId !== userId) { res.status(403).json({ error: "Seul le vendeur peut contre-proposer" }); return; }
  if (d.status !== "en_attente") { res.status(400).json({ error: `Devis déjà ${d.status}` }); return; }

  const [offre] = await db.select().from(residusTable).where(eq(residusTable.id, d.offreId));
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (counterQuantityKg > offre.quantityKg) {
    res.status(400).json({ error: `Quantité supérieure au stock disponible (${offre.quantityKg}kg)` });
    return;
  }

  const counterTotalFcfa = counterQuantityKg * counterPriceFcfa;

  const [updated] = await db.update(devisTable).set({
    status: "contre_proposé",
    counterQuantityKg,
    counterPriceFcfa,
    counterTotalFcfa,
    counterNote,
    respondedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(devisTable.id, id)).returning();

  const [seller] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, d.producteurId));
  createNotification({
    userId: d.transformateurId,
    type: "offre_correspondante",
    title: "🔄 Contre-proposition reçue",
    body: `${seller?.name ?? "Le vendeur"} propose ${FCFA(counterQuantityKg)}kg à ${FCFA(counterPriceFcfa)} FCFA/kg`,
    link: `/devis/${id}`,
  }).catch(() => undefined);

  res.json(serializeDevis(updated));
});

// ============ PUT /api/devis/:id/contre-proposer/accepter — transformateur accepts counter ════
router.put("/devis/:id/contre-proposer/accepter", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  const [d] = await db.select().from(devisTable).where(eq(devisTable.id, id));
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.transformateurId !== userId) { res.status(403).json({ error: "Seul l'acheteur peut accepter la contre-proposition" }); return; }
  if (d.status !== "contre_proposé") { res.status(400).json({ error: `Impossible dans l'état ${d.status}` }); return; }
  if (d.counterQuantityKg == null || d.counterPriceFcfa == null || d.counterTotalFcfa == null) {
    res.status(400).json({ error: "Contre-proposition incomplète" });
    return;
  }
  if (checkExpired(d.expiresAt)) { res.status(400).json({ error: "Cette contre-proposition a expiré" }); return; }

  try {
    await atomicallyAcceptDevis({
      devisId: id,
      expectedStatus: "contre_proposé",
      newStatus: "contre_proposé_accepté",
      offreId: d.offreId,
      buyerId: d.transformateurId,
      sellerId: d.producteurId,
      quantityKg: d.counterQuantityKg,
      totalFcfa: d.counterTotalFcfa,
      checkExpiry: true,
      counterResponse: true,
    });
  } catch (err: any) {
    if (err?.message === "OFFER_STOCK_INSUFFICIENT") {
      res.status(409).json({ error: "Stock insuffisant sur l'offre" }); return;
    }
    if (err?.message === "DEVIS_EXPIRED") {
      res.status(409).json({ error: "Cette contre-proposition a expiré" }); return;
    }
    if (err?.message === "DEVIS_STATE_CHANGED") {
      res.status(409).json({ error: "Ce devis a déjà été traité par ailleurs" }); return;
    }
    throw err;
  }

  const [updated] = await db.select().from(devisTable).where(eq(devisTable.id, id));

  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, d.transformateurId));
  createNotification({
    userId: d.producteurId,
    type: "transaction_confirmee",
    title: "✅ Contre-proposition acceptée",
    body: `${buyer?.name ?? "L'acheteur"} a accepté votre contre-proposition`,
    link: `/devis/${id}`,
  }).catch(() => undefined);

  res.json(serializeDevis(updated));
});

// ============ PUT /api/devis/:id/contre-proposer/refuser — transformateur refuses counter ═════
router.put("/devis/:id/contre-proposer/refuser", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;
  const counterResponseNote = typeof req.body?.counter_response_note === "string" ? req.body.counter_response_note.trim().slice(0, 500) : "";

  const [d] = await db.select().from(devisTable).where(eq(devisTable.id, id));
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.transformateurId !== userId) { res.status(403).json({ error: "Seul l'acheteur peut refuser la contre-proposition" }); return; }
  if (d.status !== "contre_proposé") { res.status(400).json({ error: `Impossible dans l'état ${d.status}` }); return; }

  const [updated] = await db.update(devisTable).set({
    status: "contre_proposé_refusé",
    counterResponseNote: counterResponseNote || null,
    counterRespondedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(devisTable.id, id)).returning();

  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, d.transformateurId));
  createNotification({
    userId: d.producteurId,
    type: "transaction_annulee",
    title: "❌ Contre-proposition refusée",
    body: `${buyer?.name ?? "L'acheteur"} a refusé votre contre-proposition`,
    link: `/devis/${id}`,
  }).catch(() => undefined);

  res.json(serializeDevis(updated));
});

// ============ GET /api/devis/offre/:offreId/active — marketplace indicator ═══
router.get("/devis/offre/:offreId/active", requireAuth, async (req, res): Promise<void> => {
  const offreId = Number(req.params.offreId);
  if (!Number.isFinite(offreId)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;

  // For transformateur: is there an active devis by me on this offer?
  const [mine] = await db.select({ id: devisTable.id, status: devisTable.status })
    .from(devisTable)
    .where(and(
      eq(devisTable.offreId, offreId),
      eq(devisTable.transformateurId, userId),
      or(
        eq(devisTable.status, "en_attente"),
        eq(devisTable.status, "contre_proposé"),
      ),
    ));

  res.json({ active_devis: mine ? { id: mine.id, status: mine.status } : null });
});

export default router;
