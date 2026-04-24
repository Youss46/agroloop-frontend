import sharp from "sharp";
import { eq, asc, sql } from "drizzle-orm";
import { db, offerPhotosTable } from "@workspace/db";

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS_PER_OFFER = 6;
export const MIN_PHOTOS_PER_OFFER = 2;

export interface ProcessedPhoto {
  fileUrl: string;
  thumbnailUrl: string;
  fileName: string | null;
}

/** Parse + validate a base64 data URL and return the raw image buffer. */
function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  if (typeof dataUrl !== "string") throw new Error("Données photo invalides");
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Format data URL invalide");
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) throw new Error(`Format non autorisé: ${mime} (JPG, PNG, WEBP uniquement)`);
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_BYTES) throw new Error(`Photo trop volumineuse (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`);
  return { buffer: buf, mime };
}

/**
 * Resize the image to max 1200px width and produce a 400px-wide thumbnail.
 * Returns base64 data URLs for both. Output format: webp (smaller).
 */
export async function processPhoto(dataUrl: string, fileName?: string): Promise<ProcessedPhoto> {
  const { buffer } = parseDataUrl(dataUrl);

  const fullBuf = await sharp(buffer)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumbBuf = await sharp(buffer)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  return {
    fileUrl: `data:image/webp;base64,${fullBuf.toString("base64")}`,
    thumbnailUrl: `data:image/webp;base64,${thumbBuf.toString("base64")}`,
    fileName: fileName ?? null,
  };
}

export async function processPhotos(dataUrls: string[], fileNames?: (string | undefined)[]): Promise<ProcessedPhoto[]> {
  return Promise.all(dataUrls.map((u, i) => processPhoto(u, fileNames?.[i])));
}

/** Insert photos for an offer, assigning positions and marking the first one as cover if no cover exists. */
export async function savePhotosForOffer(offreId: number, photos: ProcessedPhoto[]) {
  const existing = await db
    .select({ id: offerPhotosTable.id, isCover: offerPhotosTable.isCover, position: offerPhotosTable.position })
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, offreId))
    .orderBy(asc(offerPhotosTable.position));

  const hasCover = existing.some((p) => p.isCover);
  const startPos = existing.length;

  const rows = photos.map((p, idx) => ({
    offreId,
    fileUrl: p.fileUrl,
    thumbnailUrl: p.thumbnailUrl,
    fileName: p.fileName,
    isCover: !hasCover && idx === 0,
    position: startPos + idx,
  }));

  if (rows.length === 0) return [];
  return db.insert(offerPhotosTable).values(rows).returning();
}

/** After deletion: ensure positions are 0..n-1 and one photo is the cover. */
export async function rebalanceOfferPhotos(offreId: number) {
  const rows = await db
    .select()
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, offreId))
    .orderBy(asc(offerPhotosTable.position), asc(offerPhotosTable.id));

  // Rewrite positions and ensure exactly one cover (the first row).
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const desiredCover = i === 0;
    if (r.position !== i || r.isCover !== desiredCover) {
      await db
        .update(offerPhotosTable)
        .set({ position: i, isCover: desiredCover })
        .where(eq(offerPhotosTable.id, r.id));
    }
  }
  return rows.length;
}

export async function countPhotos(offreId: number): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(offerPhotosTable)
    .where(eq(offerPhotosTable.offreId, offreId));
  return Number(row?.c ?? 0);
}

export function serializePhoto(p: typeof offerPhotosTable.$inferSelect) {
  return {
    id: p.id,
    file_url: p.fileUrl,
    thumbnail_url: p.thumbnailUrl,
    file_name: p.fileName,
    is_cover: p.isCover,
    position: p.position,
    uploaded_at: p.uploadedAt.toISOString(),
  };
}
