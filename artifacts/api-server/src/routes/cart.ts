import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, cartItemsTable, residusTable, usersTable, offerPhotosTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

async function buildCartResponse(userId: number) {
  const items = await db
    .select({
      ci: cartItemsTable,
      offer: residusTable,
    })
    .from(cartItemsTable)
    .leftJoin(residusTable, eq(cartItemsTable.offreId, residusTable.id))
    .where(eq(cartItemsTable.userId, userId))
    .orderBy(cartItemsTable.addedAt);

  const sellerIds = Array.from(new Set(items.map(i => i.offer?.userId).filter((x): x is number => !!x)));
  const sellers = sellerIds.length ? await db
    .select({ id: usersTable.id, name: usersTable.name, verificationLevel: usersTable.verificationLevel, region: usersTable.region })
    .from(usersTable)
    .where(inArray(usersTable.id, sellerIds)) : [];
  const sellerMap = new Map(sellers.map(s => [s.id, s]));

  // Fetch cover photos for offers
  const offerIds = items.map(i => i.ci.offreId);
  const covers = offerIds.length ? await db
    .select({
      offreId: offerPhotosTable.offreId,
      thumbnailUrl: offerPhotosTable.thumbnailUrl,
      isCover: offerPhotosTable.isCover,
      position: offerPhotosTable.position,
    })
    .from(offerPhotosTable)
    .where(inArray(offerPhotosTable.offreId, offerIds)) : [];
  const coverMap = new Map<number, string>();
  for (const c of covers) {
    const existing = coverMap.get(c.offreId);
    if (!existing || c.isCover) coverMap.set(c.offreId, c.thumbnailUrl);
  }

  // Group by producteur
  const groups = new Map<number, any>();
  let grandTotal = 0;
  for (const { ci, offer } of items) {
    if (!offer) continue;
    const sellerId = offer.userId;
    const seller = sellerMap.get(sellerId);
    const lineTotal = ci.quantityKg * offer.priceFcfa;
    const itemObj = {
      id: ci.id,
      offre_id: ci.offreId,
      quantity_kg: ci.quantityKg,
      note: ci.note,
      added_at: ci.addedAt.toISOString(),
      offer: {
        id: offer.id,
        type_residu: offer.typeResidu,
        description: offer.description,
        quantity_kg_available: offer.quantityKg,
        unit_price_fcfa: offer.priceFcfa,
        region: offer.region,
        status: offer.status,
        cover_photo_url: coverMap.get(offer.id) ?? null,
      },
      line_total_fcfa: lineTotal,
    };
    grandTotal += lineTotal;

    if (!groups.has(sellerId)) {
      groups.set(sellerId, {
        producteur: {
          id: sellerId,
          name: seller?.name ?? "—",
          verification_level: seller?.verificationLevel ?? 0,
          region: seller?.region ?? null,
        },
        items: [],
        subtotal_fcfa: 0,
      });
    }
    const g = groups.get(sellerId)!;
    g.items.push(itemObj);
    g.subtotal_fcfa += lineTotal;
  }

  return {
    groups: Array.from(groups.values()),
    item_count: items.length,
    seller_count: groups.size,
    grand_total_fcfa: grandTotal,
  };
}

// ============ GET /api/cart ═════════════════════════════════════════════════
router.get("/cart", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const data = await buildCartResponse(req.auth!.userId);
  res.json(data);
});

// ============ GET /api/cart/count ══════════════════════════════════════════
router.get("/cart/count", requireAuth, async (req, res): Promise<void> => {
  if (req.auth!.role !== "transformateur") { res.json({ count: 0 }); return; }
  const rows = await db.select({ id: cartItemsTable.id }).from(cartItemsTable).where(eq(cartItemsTable.userId, req.auth!.userId));
  res.json({ count: rows.length });
});

// ============ POST /api/cart/add ═══════════════════════════════════════════
router.post("/cart/add", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const offreId = Number(req.body?.offre_id);
  const quantityKg = Number(req.body?.quantity_kg);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;
  const userId = req.auth!.userId;

  if (!Number.isFinite(offreId) || offreId <= 0) { res.status(400).json({ error: "ID d'offre invalide" }); return; }
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) { res.status(400).json({ error: "La quantité doit être supérieure à 0" }); return; }

  const [offer] = await db.select().from(residusTable).where(eq(residusTable.id, offreId));
  if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offer.status !== "disponible") { res.status(400).json({ error: "Offre indisponible" }); return; }
  if (offer.userId === userId) { res.status(400).json({ error: "Vous ne pouvez pas ajouter votre propre offre" }); return; }
  if (quantityKg > offer.quantityKg) {
    res.status(400).json({ error: `Quantité supérieure au stock (${offer.quantityKg}kg disponible)` }); return;
  }

  // UPSERT: try update first
  const [existing] = await db.select().from(cartItemsTable).where(and(
    eq(cartItemsTable.userId, userId),
    eq(cartItemsTable.offreId, offreId),
  ));
  if (existing) {
    await db.update(cartItemsTable).set({ quantityKg, note }).where(eq(cartItemsTable.id, existing.id));
  } else {
    try {
      await db.insert(cartItemsTable).values({ userId, offreId, quantityKg, note });
    } catch (err: any) {
      if (err?.code === "23505") {
        await db.update(cartItemsTable).set({ quantityKg, note }).where(and(
          eq(cartItemsTable.userId, userId),
          eq(cartItemsTable.offreId, offreId),
        ));
      } else { throw err; }
    }
  }

  const data = await buildCartResponse(userId);
  res.status(201).json(data);
});

// ============ PUT /api/cart/items/:offreId ═════════════════════════════════
router.put("/cart/items/:offreId", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const offreId = Number(req.params.offreId);
  const quantityKg = Number(req.body?.quantity_kg);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;
  const userId = req.auth!.userId;

  if (!Number.isFinite(offreId) || offreId <= 0) { res.status(400).json({ error: "ID invalide" }); return; }
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) { res.status(400).json({ error: "Quantité invalide" }); return; }

  const [offer] = await db.select({ quantityKg: residusTable.quantityKg }).from(residusTable).where(eq(residusTable.id, offreId));
  if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (quantityKg > offer.quantityKg) {
    res.status(400).json({ error: `Quantité supérieure au stock (${offer.quantityKg}kg disponible)` }); return;
  }

  const upd = await db.update(cartItemsTable).set({ quantityKg, note }).where(and(
    eq(cartItemsTable.userId, userId),
    eq(cartItemsTable.offreId, offreId),
  )).returning();
  if (upd.length === 0) { res.status(404).json({ error: "Article non trouvé dans le panier" }); return; }

  const data = await buildCartResponse(userId);
  res.json(data);
});

// ============ DELETE /api/cart/items/:offreId ══════════════════════════════
router.delete("/cart/items/:offreId", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const offreId = Number(req.params.offreId);
  const userId = req.auth!.userId;
  if (!Number.isFinite(offreId)) { res.status(400).json({ error: "ID invalide" }); return; }

  await db.delete(cartItemsTable).where(and(
    eq(cartItemsTable.userId, userId),
    eq(cartItemsTable.offreId, offreId),
  ));

  const data = await buildCartResponse(userId);
  res.json(data);
});

// ============ DELETE /api/cart/clear ═══════════════════════════════════════
router.delete("/cart/clear", requireAuth, requireRole("transformateur"), async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  res.json({ groups: [], item_count: 0, seller_count: 0, grand_total_fcfa: 0 });
});

export default router;
