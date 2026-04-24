import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, favoritesTable, residusTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/favorites", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;

  const offresRows: any[] = (await db.execute(sql`
    SELECT f.id AS fav_id, f.created_at AS fav_at,
           r.id, r.type_residu, r.quantity_kg, r.price_fcfa, r.region, r.status,
           r.share_count, r.view_count, r.created_at,
           u.id AS seller_id, u.name AS seller_name, u.verification_level,
           u.last_seen, u.show_online_status,
           (SELECT photo_url FROM offer_photos WHERE offre_id = r.id AND is_cover = true LIMIT 1) AS cover_photo
      FROM favorites f
      JOIN residus r ON r.id = f.offre_id
      LEFT JOIN users u ON u.id = r.user_id
     WHERE f.user_id = ${userId} AND f.type = 'offre'
     ORDER BY f.created_at DESC
  `)).rows ?? [];

  const producteursRows: any[] = (await db.execute(sql`
    SELECT f.id AS fav_id, f.created_at AS fav_at,
           u.id, u.name, u.region, u.avatar_url, u.bio, u.filieres,
           u.rating_avg, u.rating_count, u.verification_level,
           u.last_seen, u.show_online_status,
           (SELECT COUNT(*)::int FROM residus WHERE user_id = u.id AND status = 'disponible') AS active_offres
      FROM favorites f
      JOIN users u ON u.id = f.producteur_id
     WHERE f.user_id = ${userId} AND f.type = 'producteur'
     ORDER BY f.created_at DESC
  `)).rows ?? [];

  res.json({
    offres: offresRows.map((r: any) => ({
      favId: r.fav_id,
      id: r.id,
      type_residu: r.type_residu,
      quantity_kg: r.quantity_kg,
      price_fcfa: r.price_fcfa,
      region: r.region,
      status: r.status,
      share_count: r.share_count,
      view_count: r.view_count,
      coverPhoto: r.cover_photo,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      sellerVerificationLevel: r.verification_level,
      sellerLastSeen: r.last_seen,
      sellerShowOnline: r.show_online_status,
      createdAt: r.created_at,
      favoritedAt: r.fav_at,
    })),
    producteurs: producteursRows.map((r: any) => ({
      favId: r.fav_id,
      id: r.id,
      name: r.name,
      region: r.region,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      filieres: r.filieres ?? [],
      ratingAvg: Number(r.rating_avg ?? 0),
      ratingCount: r.rating_count ?? 0,
      verificationLevel: r.verification_level,
      activeOffres: r.active_offres,
      lastSeen: r.last_seen,
      showOnlineStatus: r.show_online_status,
      favoritedAt: r.fav_at,
    })),
  });
});

router.post("/favorites", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const type = String(req.body?.type ?? "");
  const offreId = req.body?.offre_id != null ? Number(req.body.offre_id) : null;
  const producteurId = req.body?.producteur_id != null ? Number(req.body.producteur_id) : null;

  if (!["offre", "producteur"].includes(type)) {
    res.status(400).json({ error: "Type invalide" });
    return;
  }
  if (type === "offre" && (!Number.isInteger(offreId) || offreId! <= 0)) {
    res.status(400).json({ error: "offre_id invalide" });
    return;
  }
  if (type === "producteur" && (!Number.isInteger(producteurId) || producteurId! <= 0)) {
    res.status(400).json({ error: "producteur_id invalide" });
    return;
  }

  if (type === "offre") {
    const [exists] = await db.select({ id: residusTable.id }).from(residusTable).where(eq(residusTable.id, offreId!)).limit(1);
    if (!exists) { res.status(404).json({ error: "Offre introuvable" }); return; }
    await db.execute(sql`
      INSERT INTO favorites (user_id, type, offre_id) VALUES (${userId}, 'offre', ${offreId})
      ON CONFLICT (user_id, offre_id) WHERE offre_id IS NOT NULL DO NOTHING
    `);
  } else {
    if (producteurId === userId) { res.status(400).json({ error: "Vous ne pouvez pas vous suivre vous-même" }); return; }
    const [exists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, producteurId!)).limit(1);
    if (!exists) { res.status(404).json({ error: "Producteur introuvable" }); return; }
    await db.execute(sql`
      INSERT INTO favorites (user_id, type, producteur_id) VALUES (${userId}, 'producteur', ${producteurId})
      ON CONFLICT (user_id, producteur_id) WHERE producteur_id IS NOT NULL DO NOTHING
    `);
  }
  res.json({ favorited: true });
});

router.delete("/favorites/:type/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const type = req.params.type;
  const id = Number(req.params.id);
  if (!["offre", "producteur"].includes(type)) { res.status(400).json({ error: "Type invalide" }); return; }
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID invalide" }); return; }

  if (type === "offre") {
    await db.delete(favoritesTable).where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.offreId, id)));
  } else {
    await db.delete(favoritesTable).where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.producteurId, id)));
  }
  res.json({ favorited: false });
});

router.get("/favorites/check/:type/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const type = req.params.type;
  const id = Number(req.params.id);
  if (!["offre", "producteur"].includes(type)) { res.status(400).json({ error: "Type invalide" }); return; }
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID invalide" }); return; }

  let row;
  if (type === "offre") {
    [row] = await db.select({ id: favoritesTable.id }).from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.offreId, id))).limit(1);
  } else {
    [row] = await db.select({ id: favoritesTable.id }).from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.producteurId, id))).limit(1);
  }
  res.json({ favorited: !!row });
});

router.get("/favorites/count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const row: any = (await db.execute(sql`SELECT COUNT(*)::int AS c FROM favorites WHERE user_id = ${userId}`)).rows?.[0] ?? { c: 0 };
  res.json({ count: Number(row.c) });
});

export default router;
