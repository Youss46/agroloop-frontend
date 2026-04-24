import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  verificationRequestsTable,
  verificationDocumentsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { validateDataUrl } from "../lib/data-url";

const router: IRouter = Router();

const ALLOWED_DOC_TYPES = new Set([
  "cni",
  "passeport",
  "carte_cooperative",
  "photo_parcelle",
  "rccm",
  "attestation_fiscale",
]);

function serializeRequest(r: any) {
  return {
    id: r.id,
    userId: r.userId,
    level: r.level,
    status: r.status,
    rejectionReason: r.rejectionReason ?? null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

function serializeDoc(d: any) {
  return {
    id: d.id,
    documentType: d.documentType,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

router.get("/verification/status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }
  const requests = await db
    .select()
    .from(verificationRequestsTable)
    .where(eq(verificationRequestsTable.userId, userId))
    .orderBy(desc(verificationRequestsTable.createdAt))
    .limit(1);
  const current = requests[0];
  let documents: any[] = [];
  if (current) {
    documents = await db
      .select()
      .from(verificationDocumentsTable)
      .where(eq(verificationDocumentsTable.requestId, current.id));
  }
  res.json({
    verificationStatus: (user as any).verificationStatus ?? "non_verifie",
    verificationLevel: (user as any).verificationLevel ?? 0,
    verifiedAt: (user as any).verifiedAt ? (user as any).verifiedAt.toISOString() : null,
    currentRequest: current ? serializeRequest(current) : null,
    documents: documents.map(serializeDoc),
  });
});

router.post("/verification/submit", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const { level, documents } = req.body ?? {};
  if (level !== "identite" && level !== "professionnel") {
    res.status(400).json({ error: "Niveau de vérification invalide" });
    return;
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    res.status(400).json({ error: "Au moins un document est requis" });
    return;
  }
  if (documents.length > 6) {
    res.status(400).json({ error: "Maximum 6 documents par demande" });
    return;
  }
  const IDENTITY_DOCS = new Set(["cni", "passeport"]);
  const PRO_DOCS = new Set(["carte_cooperative", "photo_parcelle", "rccm", "attestation_fiscale"]);
  let totalBytes = 0;
  let identityCount = 0;
  let proCount = 0;
  for (const d of documents) {
    if (!d || typeof d.documentType !== "string" || !ALLOWED_DOC_TYPES.has(d.documentType)) {
      res.status(400).json({ error: `Type de document invalide: ${d?.documentType}` });
      return;
    }
    if (typeof d.fileName !== "string" || d.fileName.length === 0 || d.fileName.length > 255) {
      res.status(400).json({ error: "Nom de fichier invalide" });
      return;
    }
    const v = validateDataUrl(d.dataUrl, 2 * 1024 * 1024);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    totalBytes += v.bytes;
    if (IDENTITY_DOCS.has(d.documentType)) identityCount++;
    if (PRO_DOCS.has(d.documentType)) proCount++;
  }
  if (totalBytes > 8 * 1024 * 1024) {
    res.status(400).json({ error: "Taille totale des fichiers trop élevée (max 8 Mo)" });
    return;
  }
  if (identityCount === 0) {
    res.status(400).json({ error: "Une pièce d'identité (CNI ou passeport) est obligatoire" });
    return;
  }
  if (level === "professionnel" && proCount === 0) {
    res.status(400).json({ error: "Au moins un document professionnel est requis (carte coopérative, photo parcelle, RCCM ou attestation fiscale)" });
    return;
  }

  const existing = await db
    .select()
    .from(verificationRequestsTable)
    .where(and(eq(verificationRequestsTable.userId, userId), eq(verificationRequestsTable.status, "en_attente")))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "Une demande est déjà en attente de validation" });
    return;
  }

  const [created] = await db
    .insert(verificationRequestsTable)
    .values({ userId, level, status: "en_attente" })
    .returning();

  await db.insert(verificationDocumentsTable).values(
    documents.map((d: any) => ({
      requestId: created.id,
      documentType: d.documentType,
      fileUrl: d.dataUrl,
      fileName: d.fileName,
    })),
  );

  await db
    .update(usersTable)
    .set({ verificationStatus: "en_attente" } as any)
    .where(eq(usersTable.id, userId));

  res.status(201).json(serializeRequest(created));
});

router.delete("/verification/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [pending] = await db
    .select()
    .from(verificationRequestsTable)
    .where(and(eq(verificationRequestsTable.userId, userId), eq(verificationRequestsTable.status, "en_attente")))
    .limit(1);
  if (!pending) {
    res.status(404).json({ error: "Aucune demande en attente" });
    return;
  }
  await db.delete(verificationRequestsTable).where(eq(verificationRequestsTable.id, pending.id));

  // Restore user verification status based on prior verified level
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const lvl = (user as any)?.verificationLevel ?? 0;
  const newStatus = lvl >= 2 ? "professionnel_verifie" : lvl === 1 ? "identite_verifie" : "non_verifie";
  await db.update(usersTable).set({ verificationStatus: newStatus } as any).where(eq(usersTable.id, userId));

  res.json({ success: true });
});

export default router;
