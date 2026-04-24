import { Router, type IRouter } from "express";
import { eq, and, gte, lte, ilike, or, isNotNull, sql, ne, asc, inArray } from "drizzle-orm";
import { db, residusTable, usersTable, userPreferencesTable, offerPhotosTable, flaggedOffersTable, offerViewsTable, conversionEventsTable } from "@workspace/db";
import { createNotification } from "../lib/notifications";
import {
  processPhotos,
  savePhotosForOffer,
  rebalanceOfferPhotos,
  countPhotos,
  serializePhoto,
  MAX_PHOTOS_PER_OFFER,
  MIN_PHOTOS_PER_OFFER,
} from "../lib/offer-photos";
import {
  CreateOffreBody,
  UpdateOffreBody,
  GetOffreParams,
  UpdateOffreParams,
  DeleteOffreParams,
  ListOffresQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { checkFeatureAccess } from "../lib/subscriptions";
import { verifyJwtWithVersion } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/offres", async (req, res): Promise<void> => {
  const parsed = ListOffresQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const q = parsed.data as any;
  const type_residu: string | undefined = q.type_residu ?? undefined;
  const region: string | undefined = q.region ?? undefined;
  const status: string | undefined = q.status ?? undefined;
  const search: string | undefined = q.search ?? undefined;
  const price_min: number | undefined = q.prix_min ?? q.price_min ?? undefined;
  const price_max: number | undefined = q.prix_max ?? q.price_max ?? undefined;
  let lat: number | undefined = q.lat ?? undefined;
  let lng: number | undefined = q.lng ?? undefined;
  let radius_km: number | undefined = q.radius_km ?? undefined;
  const disponibilite: "immediate" | "planifiee" | undefined = q.disponibilite ?? undefined;
  const livraison_possible: boolean | undefined =
    typeof q.livraison_possible === "boolean"
      ? q.livraison_possible
      : q.livraison_possible === "true"
        ? true
        : q.livraison_possible === "false"
          ? false
          : undefined;
  let sort_by: "date" | "prix_asc" | "prix_desc" | "distance" | undefined = q.sort_by ?? undefined;

  // Distance filter is a Pro feature. Strip geo params for free transformateurs.
  let featureLocked = false;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = await verifyJwtWithVersion(authHeader.slice(7));
      if (decoded && decoded.role === "transformateur") {
        const allowed = await checkFeatureAccess(decoded.userId, "filtre_distance");
        if (!allowed && (lat != null || lng != null || radius_km != null || sort_by === "distance")) {
          lat = undefined; lng = undefined; radius_km = undefined;
          if (sort_by === "distance") sort_by = "date";
          featureLocked = true;
        }
      }
    } catch { /* invalid token: ignore, treated as anonymous */ }
  }
  if (featureLocked) res.setHeader("X-Feature-Locked", "filtre_distance");

  const hasGeo = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);

  const conditions = [];
  if (status) {
    conditions.push(eq(residusTable.status, status as "disponible" | "vendu" | "expiré"));
  } else {
    conditions.push(eq(residusTable.status, "disponible"));
  }
  if (type_residu) conditions.push(eq(residusTable.typeResidu, type_residu));
  if (region) conditions.push(eq(residusTable.region, region));
  if (price_min != null) conditions.push(gte(residusTable.priceFcfa, price_min));
  if (price_max != null) conditions.push(lte(residusTable.priceFcfa, price_max));
  if (disponibilite) conditions.push(eq(residusTable.disponibilite, disponibilite));
  if (livraison_possible === true) conditions.push(eq(residusTable.livraisonPossible, true));
  if (search) {
    conditions.push(
      or(
        ilike(residusTable.typeResidu, `%${search}%`),
        ilike(residusTable.region, `%${search}%`),
        ilike(residusTable.description, `%${search}%`),
      )
    );
  }
  if (hasGeo && radius_km != null && radius_km > 0) {
    conditions.push(sql`ST_DWithin(localisation, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius_km * 1000})`);
  }

  const distanceExpr = hasGeo
    ? sql<number>`ST_Distance(localisation, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0`
    : sql<number | null>`NULL::float8`;

  let orderBy;
  if (sort_by === "prix_asc") orderBy = sql`${usersTable.verificationLevel} DESC, ${residusTable.priceFcfa} ASC`;
  else if (sort_by === "prix_desc") orderBy = sql`${usersTable.verificationLevel} DESC, ${residusTable.priceFcfa} DESC`;
  else if (sort_by === "distance" && hasGeo) orderBy = sql`${usersTable.verificationLevel} DESC, localisation <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  else orderBy = sql`${usersTable.verificationLevel} DESC, ${residusTable.createdAt} DESC`;

  const coverSubquery = sql<string | null>`(
    SELECT thumbnail_url FROM offer_photos
    WHERE offre_id = ${residusTable.id} AND is_cover = true
    LIMIT 1
  )`;
  const photoCountSubquery = sql<number>`(
    SELECT count(*)::int FROM offer_photos WHERE offre_id = ${residusTable.id}
  )`;

  const rows = await db
    .select({
      id: residusTable.id,
      userId: residusTable.userId,
      sellerId: residusTable.userId,
      typeResidu: residusTable.typeResidu,
      quantityKg: residusTable.quantityKg,
      priceFcfa: residusTable.priceFcfa,
      latitude: residusTable.latitude,
      longitude: residusTable.longitude,
      region: residusTable.region,
      description: residusTable.description,
      status: residusTable.status,
      createdAt: residusTable.createdAt,
      disponibilite: residusTable.disponibilite,
      dateDisponibilite: residusTable.dateDisponibilite,
      livraisonPossible: residusTable.livraisonPossible,
      sellerName: usersTable.name,
      sellerPhone: usersTable.phone,
      sellerRatingAvg: usersTable.ratingAvg,
      sellerRatingCount: usersTable.ratingCount,
      sellerVerificationLevel: usersTable.verificationLevel,
      sellerVerificationStatus: usersTable.verificationStatus,
      distanceKm: distanceExpr,
      coverPhotoUrl: coverSubquery,
      photoCount: photoCountSubquery,
    })
    .from(residusTable)
    .leftJoin(usersTable, eq(residusTable.userId, usersTable.id))
    .where(and(...conditions))
    .orderBy(orderBy);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    sellerName: r.sellerName ?? "Inconnu",
    sellerRatingAvg: Number(r.sellerRatingAvg ?? 0),
    sellerRatingCount: r.sellerRatingCount ?? 0,
    distanceKm: r.distanceKm != null ? Number(r.distanceKm) : null,
    cover_photo_url: r.coverPhotoUrl,
    photo_count: Number(r.photoCount ?? 0),
  })));
});

router.get("/offres/map", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: residusTable.id,
      typeResidu: residusTable.typeResidu,
      quantityKg: residusTable.quantityKg,
      priceFcfa: residusTable.priceFcfa,
      region: residusTable.region,
      latitude: residusTable.latitude,
      longitude: residusTable.longitude,
      sellerName: usersTable.name,
      sellerPhone: usersTable.phone,
      livraisonPossible: residusTable.livraisonPossible,
    })
    .from(residusTable)
    .leftJoin(usersTable, eq(residusTable.userId, usersTable.id))
    .where(
      and(
        eq(residusTable.status, "disponible"),
        isNotNull(residusTable.latitude),
        isNotNull(residusTable.longitude),
      )
    );

  res.json(rows
    .filter(r => r.latitude != null && r.longitude != null)
    .map(r => ({
      id: r.id,
      typeResidu: r.typeResidu,
      quantityKg: r.quantityKg,
      priceFcfa: r.priceFcfa,
      region: r.region,
      latitude: r.latitude!,
      longitude: r.longitude!,
      sellerName: r.sellerName ?? "Inconnu",
      sellerPhone: r.sellerPhone,
      livraisonPossible: r.livraisonPossible ?? false,
    })));
});

router.get("/offres/mes-offres", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;

  const rows = await db
    .select()
    .from(residusTable)
    .where(eq(residusTable.userId, userId))
    .orderBy(residusTable.createdAt);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.get("/offres/:id", async (req, res): Promise<void> => {
  const params = GetOffreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Public route — auth is OPTIONAL. If a valid JWT is provided we use it
  // to decide whether to expose seller contact details.
  let viewerId: number | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded: any = (await import("jsonwebtoken")).default.verify(
        authHeader.slice(7),
        process.env.JWT_SECRET ?? "agroloopci-dev-secret",
      );
      viewerId = decoded?.userId ?? null;
    } catch { /* ignore */ }
  }

  const [row] = await db
    .select({
      id: residusTable.id,
      userId: residusTable.userId,
      sellerId: residusTable.userId,
      typeResidu: residusTable.typeResidu,
      quantityKg: residusTable.quantityKg,
      priceFcfa: residusTable.priceFcfa,
      latitude: residusTable.latitude,
      longitude: residusTable.longitude,
      region: residusTable.region,
      description: residusTable.description,
      status: residusTable.status,
      createdAt: residusTable.createdAt,
      sellerName: usersTable.name,
      sellerPhone: usersTable.phone,
      sellerEmail: usersTable.email,
      sellerRatingAvg: usersTable.ratingAvg,
      sellerRatingCount: usersTable.ratingCount,
      sellerLastSeen: usersTable.lastSeen,
      sellerShowOnline: usersTable.showOnlineStatus,
      disponibilite: residusTable.disponibilite,
      dateDisponibilite: residusTable.dateDisponibilite,
      livraisonPossible: residusTable.livraisonPossible,
      shareCount: residusTable.shareCount,
      viewCount: residusTable.viewCount,
    })
    .from(residusTable)
    .leftJoin(usersTable, eq(residusTable.userId, usersTable.id))
    .where(eq(residusTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Offre introuvable" });
    return;
  }

  // Increment view_count (best-effort; don't block response on failure).
  // Skip if viewer is the seller themselves.
  if (viewerId !== row.sellerId) {
    db.execute(sql`UPDATE residus SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ${row.id}`)
      .catch(() => { /* ignore */ });
    // Track offer view
    const sessionId = (req as any).analyticsSessionId ?? "unknown";
    db.insert(offerViewsTable).values({
      offreId: row.id,
      viewerId: viewerId ?? undefined,
      sessionId,
    }).catch(() => { /* ignore */ });
  }

  const photos = await db
    .select()
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, row.id))
    .orderBy(asc(offerPhotosTable.position), asc(offerPhotosTable.id));

  // Only expose contact details when viewer is authenticated.
  const isAuthed = !!viewerId;
  res.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    sellerName: row.sellerName ?? "Inconnu",
    sellerPhone: isAuthed ? row.sellerPhone : null,
    sellerEmail: isAuthed ? row.sellerEmail : null,
    sellerRatingAvg: Number(row.sellerRatingAvg ?? 0),
    sellerRatingCount: row.sellerRatingCount ?? 0,
    photos: photos.map(serializePhoto),
    viewerAuthenticated: isAuthed,
  });
});

router.post("/offres/:id/share-view", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID invalide" }); return; }
  const rows: any = (await db.execute(sql`
    UPDATE residus SET share_count = COALESCE(share_count, 0) + 1
     WHERE id = ${id}
    RETURNING share_count
  `)).rows ?? [];
  if (!rows.length) { res.status(404).json({ error: "Offre introuvable" }); return; }
  res.json({ share_count: Number(rows[0].share_count) });
});

router.post("/offres", requireAuth, requireRole("producteur"), async (req, res): Promise<void> => {
  const parsed = CreateOffreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Photos are required: validate before any DB write
  const rawPhotos = req.body?.photos;
  const rawNames = req.body?.file_names;
  if (!Array.isArray(rawPhotos) || rawPhotos.length < MIN_PHOTOS_PER_OFFER) {
    res.status(400).json({ error: `Minimum ${MIN_PHOTOS_PER_OFFER} photos requises` });
    return;
  }
  if (rawPhotos.length > MAX_PHOTOS_PER_OFFER) {
    res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_OFFER} photos par offre` });
    return;
  }
  let processedPhotos;
  try {
    processedPhotos = await processPhotos(rawPhotos, Array.isArray(rawNames) ? rawNames : undefined);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Photo invalide" });
    return;
  }

  const userId = req.auth!.userId;
  const { typeResidu, quantityKg, priceFcfa, region, description, latitude, longitude, disponibilite, dateDisponibilite, livraisonPossible } = parsed.data as any;

  const { residu, insertedPhotos } = await db.transaction(async (tx) => {
    const [residu] = await tx.insert(residusTable).values({
      userId,
      typeResidu,
      quantityKg,
      priceFcfa,
      region,
      description: description ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      disponibilite: (disponibilite as "immediate" | "planifiee" | undefined) ?? "immediate",
      dateDisponibilite: dateDisponibilite && dateDisponibilite !== "" ? dateDisponibilite : null,
      livraisonPossible: livraisonPossible === true,
      status: "disponible",
    }).returning();

    const photoRows = processedPhotos.map((p, idx) => ({
      offreId: residu.id,
      fileUrl: p.fileUrl,
      thumbnailUrl: p.thumbnailUrl,
      fileName: p.fileName,
      isCover: idx === 0,
      position: idx,
    }));
    const insertedPhotos = await tx.insert(offerPhotosTable).values(photoRows).returning();
    return { residu, insertedPhotos };
  });

  res.status(201).json({
    ...residu,
    createdAt: residu.createdAt.toISOString(),
    photos: insertedPhotos.map(serializePhoto),
  });

  // Track first_offer conversion (fire-and-forget)
  db.select({ c: sql<number>`count(*)::int` })
    .from(residusTable)
    .where(eq(residusTable.userId, userId))
    .then(([row]) => {
      if ((row?.c ?? 0) <= 1) {
        const sessionId = (req as any).analyticsSessionId ?? "unknown";
        return db.insert(conversionEventsTable).values({
          eventType: "first_offer",
          userId,
          sessionId,
          metadata: { typeResidu },
        });
      }
    })
    .catch(() => { /* ignore */ });

  // Fan out "offre_correspondante" notifications to matching transformateurs (fire-and-forget)
  (async () => {
    try {
      const matches = await db
        .select({
          userId: userPreferencesTable.userId,
          residus: userPreferencesTable.residusSouhaites,
          filieres: userPreferencesTable.filieresSouhaitees,
          regions: userPreferencesTable.regionsSouhaitees,
          prixMax: userPreferencesTable.prixMaxFcfa,
          notifMatch: userPreferencesTable.notifOffreMatch,
          role: usersTable.role,
        })
        .from(userPreferencesTable)
        .innerJoin(usersTable, eq(usersTable.id, userPreferencesTable.userId))
        .where(and(
          eq(usersTable.role, "transformateur"),
          eq(userPreferencesTable.notifOffreMatch, true),
          ne(usersTable.id, residu.userId),
          sql`(
            ${residu.typeResidu} = ANY(${userPreferencesTable.residusSouhaites})
            OR cardinality(${userPreferencesTable.residusSouhaites}) = 0
          )`,
          sql`(
            cardinality(${userPreferencesTable.regionsSouhaitees}) = 0
            OR ${residu.region} = ANY(${userPreferencesTable.regionsSouhaitees})
          )`,
          sql`(
            ${userPreferencesTable.prixMaxFcfa} IS NULL
            OR ${userPreferencesTable.prixMaxFcfa} >= ${residu.priceFcfa}
          )`,
        ));
      for (const m of matches) {
        await createNotification({
          userId: m.userId,
          type: "offre_correspondante",
          title: `Nouvelle offre de résidus agricoles : ${residu.typeResidu}`,
          body: `${residu.quantityKg}kg disponible à ${residu.region} — ${residu.priceFcfa} FCFA`,
          link: `/marketplace?offer=${residu.id}`,
        });
      }
    } catch (e) {
      // swallow to avoid affecting response
    }
  })();
});

router.put("/offres/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOffreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOffreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(residusTable).where(eq(residusTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Offre introuvable" });
    return;
  }

  if (existing.userId !== req.auth!.userId) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.typeResidu != null) updateData.typeResidu = d.typeResidu;
  if (d.quantityKg != null) updateData.quantityKg = d.quantityKg;
  if (d.priceFcfa != null) updateData.priceFcfa = d.priceFcfa;
  if (d.region != null) updateData.region = d.region;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.status != null) updateData.status = d.status;
  if (d.latitude !== undefined) updateData.latitude = d.latitude;
  if (d.longitude !== undefined) updateData.longitude = d.longitude;

  // Photo edits: deleted_photo_ids (array of ids to remove) and photos (new ones to add)
  const rawDeletedIds: number[] = Array.isArray(req.body?.deleted_photo_ids)
    ? Array.from(new Set(req.body.deleted_photo_ids.map(Number).filter((n: number) => Number.isFinite(n))))
    : [];
  const newPhotos: string[] = Array.isArray(req.body?.photos) ? req.body.photos : [];
  const newFileNames: (string | undefined)[] | undefined = Array.isArray(req.body?.file_names) ? req.body.file_names : undefined;

  // Validate deleted IDs actually belong to this offer
  let deletedIds: number[] = [];
  if (rawDeletedIds.length > 0) {
    const owned = await db
      .select({ id: offerPhotosTable.id })
      .from(offerPhotosTable)
      .where(and(eq(offerPhotosTable.offreId, params.data.id), inArray(offerPhotosTable.id, rawDeletedIds)));
    const ownedSet = new Set(owned.map((r) => r.id));
    if (ownedSet.size !== rawDeletedIds.length) {
      res.status(400).json({ error: "deleted_photo_ids contient des identifiants invalides" });
      return;
    }
    deletedIds = rawDeletedIds;
  }

  if (newPhotos.length > MAX_PHOTOS_PER_OFFER) {
    res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_OFFER} photos par offre` });
    return;
  }

  if (deletedIds.length > 0 || newPhotos.length > 0) {
    const currentCount = await countPhotos(params.data.id);
    const remaining = currentCount - deletedIds.length + newPhotos.length;
    if (remaining < MIN_PHOTOS_PER_OFFER) {
      res.status(400).json({ error: `Vous devez conserver au moins ${MIN_PHOTOS_PER_OFFER} photos` });
      return;
    }
    if (remaining > MAX_PHOTOS_PER_OFFER) {
      res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_OFFER} photos par offre` });
      return;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(residusTable).set(updateData).where(eq(residusTable.id, params.data.id));
  }

  if (deletedIds.length > 0) {
    await db.delete(offerPhotosTable).where(and(
      eq(offerPhotosTable.offreId, params.data.id),
      inArray(offerPhotosTable.id, deletedIds),
    ));
    await rebalanceOfferPhotos(params.data.id);
  }

  if (newPhotos.length > 0) {
    let processed;
    try {
      processed = await processPhotos(newPhotos, newFileNames);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Photo invalide" });
      return;
    }
    await savePhotosForOffer(params.data.id, processed);
  }

  const [updated] = await db.select().from(residusTable).where(eq(residusTable.id, params.data.id));
  const photos = await db
    .select()
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, params.data.id))
    .orderBy(asc(offerPhotosTable.position));

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    photos: photos.map(serializePhoto),
  });
});

router.delete("/offres/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteOffreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(residusTable).where(eq(residusTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Offre introuvable" });
    return;
  }

  if (existing.userId !== req.auth!.userId) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  await db.delete(residusTable).where(eq(residusTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/offres/:id/flag", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID invalide" }); return; }
  const reason = String(req.body?.reason ?? "").trim();
  const comment = String(req.body?.comment ?? "").trim().slice(0, 1000) || null;
  const ALLOWED = ["spam", "fraude_arnaque", "contenu_inapproprié", "produit_interdit", "informations_trompeuses", "autre"];
  if (!ALLOWED.includes(reason)) { res.status(400).json({ error: "Motif invalide" }); return; }
  const [offre] = await db.select().from(residusTable).where(eq(residusTable.id, id)).limit(1);
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offre.userId === req.auth!.userId) { res.status(400).json({ error: "Vous ne pouvez pas signaler votre propre offre" }); return; }
  const existing = await db.select().from(flaggedOffersTable)
    .where(and(eq(flaggedOffersTable.offreId, id), eq(flaggedOffersTable.reportedBy, req.auth!.userId), eq(flaggedOffersTable.status, "en_attente")))
    .limit(1);
  if (existing.length) { res.status(400).json({ error: "Vous avez déjà signalé cette offre" }); return; }
  const [row] = await db.insert(flaggedOffersTable).values({
    offreId: id, reportedBy: req.auth!.userId, reason, comment,
  }).returning();
  res.json({ success: true, id: row.id });
});

export default router;
