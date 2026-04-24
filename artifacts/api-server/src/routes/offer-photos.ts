import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, offerPhotosTable, residusTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  processPhotos,
  savePhotosForOffer,
  rebalanceOfferPhotos,
  countPhotos,
  serializePhoto,
  MAX_PHOTOS_PER_OFFER,
  MIN_PHOTOS_PER_OFFER,
} from "../lib/offer-photos";

const router: IRouter = Router();

async function loadOffreOwner(offreId: number) {
  const [r] = await db.select({ id: residusTable.id, userId: residusTable.userId }).from(residusTable).where(eq(residusTable.id, offreId));
  return r ?? null;
}

// GET /offres/:id/photos (public) — returns all photos for an offer ordered by position
router.get("/offres/:id/photos", async (req, res): Promise<void> => {
  const offreId = Number(req.params.id);
  if (!Number.isFinite(offreId)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const rows = await db
    .select()
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, offreId))
    .orderBy(asc(offerPhotosTable.position), asc(offerPhotosTable.id));
  res.json(rows.map(serializePhoto));
});

// POST /offres/:id/photos (owner) — add new photos
router.post("/offres/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const offreId = Number(req.params.id);
  const userId = req.auth!.userId;
  const photos = req.body?.photos;
  const fileNames = req.body?.file_names;

  if (!Array.isArray(photos) || photos.length === 0) {
    res.status(400).json({ error: "Aucune photo fournie" });
    return;
  }
  const offre = await loadOffreOwner(offreId);
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offre.userId !== userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  const existingCount = await countPhotos(offreId);
  if (existingCount + photos.length > MAX_PHOTOS_PER_OFFER) {
    res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_OFFER} photos par offre` });
    return;
  }

  let processed;
  try {
    processed = await processPhotos(photos, Array.isArray(fileNames) ? fileNames : undefined);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Photo invalide" });
    return;
  }

  const inserted = await savePhotosForOffer(offreId, processed);
  res.status(201).json(inserted.map(serializePhoto));
});

// DELETE /offres/:id/photos/:photoId (owner)
router.delete("/offres/:id/photos/:photoId", requireAuth, async (req, res): Promise<void> => {
  const offreId = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const userId = req.auth!.userId;
  if (!Number.isFinite(offreId) || !Number.isFinite(photoId)) {
    res.status(400).json({ error: "ID invalide" }); return;
  }
  const offre = await loadOffreOwner(offreId);
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offre.userId !== userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  const existing = await countPhotos(offreId);
  if (existing - 1 < MIN_PHOTOS_PER_OFFER) {
    res.status(400).json({ error: `Vous devez conserver au moins ${MIN_PHOTOS_PER_OFFER} photos` });
    return;
  }

  await db.delete(offerPhotosTable).where(and(eq(offerPhotosTable.id, photoId), eq(offerPhotosTable.offreId, offreId)));
  await rebalanceOfferPhotos(offreId);
  res.sendStatus(204);
});

// PUT /offres/:id/photos/reorder (owner) — body: { ordered_ids: [photoId,...] }
router.put("/offres/:id/photos/reorder", requireAuth, async (req, res): Promise<void> => {
  const offreId = Number(req.params.id);
  const userId = req.auth!.userId;
  const orderedIds = req.body?.ordered_ids;

  if (!Array.isArray(orderedIds) || orderedIds.some((x) => !Number.isFinite(Number(x)))) {
    res.status(400).json({ error: "ordered_ids invalide" }); return;
  }
  const offre = await loadOffreOwner(offreId);
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offre.userId !== userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  const rows = await db.select().from(offerPhotosTable).where(eq(offerPhotosTable.offreId, offreId));
  const idsInDb = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== rows.length || !orderedIds.every((id) => idsInDb.has(Number(id)))) {
    res.status(400).json({ error: "ordered_ids ne correspond pas aux photos de l'offre" });
    return;
  }

  // First, clear the cover flag to avoid violating the unique partial index.
  await db.update(offerPhotosTable).set({ isCover: false }).where(eq(offerPhotosTable.offreId, offreId));
  for (let i = 0; i < orderedIds.length; i++) {
    const id = Number(orderedIds[i]);
    await db.update(offerPhotosTable)
      .set({ position: i, isCover: i === 0 })
      .where(eq(offerPhotosTable.id, id));
  }

  const updated = await db
    .select()
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, offreId))
    .orderBy(asc(offerPhotosTable.position));
  res.json(updated.map(serializePhoto));
});

export default router;
