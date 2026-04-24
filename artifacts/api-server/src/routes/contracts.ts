import { Router, type IRouter } from "express";
import fs from "node:fs";
import { eq, and, isNull } from "drizzle-orm";
import { db, contractsTable, transactionsTable, residusTable, usersTable, isAdminRole } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { generateContractForTransaction, regeneratePdfWithSignatures, serializeContract } from "../lib/contracts";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

async function loadParties(transactionId: number) {
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, transactionId));
  if (!tx) return null;
  return tx;
}

async function isAdmin(userId: number) {
  const [me] = await db.select({ role: usersTable.role, isAdminActive: usersTable.isAdminActive }).from(usersTable).where(eq(usersTable.id, userId));
  return !!me && isAdminRole(me.role) && me.isAdminActive !== false;
}

// GET /api/contracts/:transactionId — metadata (auth: seller or buyer)
router.get("/contracts/:transactionId", requireAuth, async (req, res): Promise<void> => {
  const txId = Number(req.params.transactionId);
  if (!Number.isFinite(txId)) { res.status(400).json({ error: "ID invalide" }); return; }
  const tx = await loadParties(txId);
  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  const userId = req.auth!.userId;
  if (tx.buyerId !== userId && tx.sellerId !== userId && !(await isAdmin(userId))) { res.status(403).json({ error: "Accès refusé" }); return; }

  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.transactionId, txId));
  if (!c) { res.status(404).json({ error: "Aucun bon de commande disponible" }); return; }
  res.json(serializeContract(c));
});

// GET /api/contracts/:transactionId/download — streams the PDF
router.get("/contracts/:transactionId/download", requireAuth, async (req, res): Promise<void> => {
  const txId = Number(req.params.transactionId);
  if (!Number.isFinite(txId)) { res.status(400).json({ error: "ID invalide" }); return; }
  const tx = await loadParties(txId);
  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  const userId = req.auth!.userId;
  if (tx.buyerId !== userId && tx.sellerId !== userId && !(await isAdmin(userId))) { res.status(403).json({ error: "Accès refusé" }); return; }

  // Feature gate: transformateur buyers must have telechargement_contrats (Pro/Business)
  if (req.auth!.role === "transformateur" && tx.buyerId === userId) {
    const { checkFeatureAccess } = await import("../lib/subscriptions");
    const allowed = await checkFeatureAccess(userId, "telechargement_contrats");
    if (!allowed) {
      res.status(403).json({
        error: "FEATURE_LOCKED",
        message: "Le téléchargement des bons de commande nécessite un abonnement Pro",
        feature: "telechargement_contrats",
        upgrade_url: "/abonnement",
      });
      return;
    }
  }

  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.transactionId, txId));
  if (!c) { res.status(404).json({ error: "Aucun bon de commande disponible" }); return; }
  if (!fs.existsSync(c.pdfUrl)) { res.status(404).json({ error: "Fichier PDF introuvable" }); return; }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="AgroLoopCI_${c.reference}.pdf"`);
  fs.createReadStream(c.pdfUrl).pipe(res);
});

// POST /api/contracts/:transactionId/sign — record signature
router.post("/contracts/:transactionId/sign", requireAuth, async (req, res): Promise<void> => {
  const txId = Number(req.params.transactionId);
  if (!Number.isFinite(txId)) { res.status(400).json({ error: "ID invalide" }); return; }
  const tx = await loadParties(txId);
  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  const userId = req.auth!.userId;
  if (tx.buyerId !== userId && tx.sellerId !== userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.transactionId, txId));
  if (!c) { res.status(404).json({ error: "Aucun bon de commande disponible" }); return; }

  const isSeller = tx.sellerId === userId;
  if (isSeller && c.sellerSignedAt) { res.status(400).json({ error: "Déjà signé par le vendeur" }); return; }
  if (!isSeller && c.buyerSignedAt) { res.status(400).json({ error: "Déjà signé par l'acheteur" }); return; }

  const now = new Date();
  // Atomic conditional update — only succeeds if the column is still NULL.
  const cond = isSeller
    ? and(eq(contractsTable.id, c.id), isNull(contractsTable.sellerSignedAt))
    : and(eq(contractsTable.id, c.id), isNull(contractsTable.buyerSignedAt));
  const updRows = await db.update(contractsTable)
    .set(isSeller ? { sellerSignedAt: now } : { buyerSignedAt: now })
    .where(cond)
    .returning();
  if (updRows.length === 0) { res.status(409).json({ error: "Signature concurrente détectée, réessayez" }); return; }
  // Re-fetch fresh row to compute correct status against latest seller+buyer state
  const [fresh] = await db.select().from(contractsTable).where(eq(contractsTable.id, c.id));
  const newStatus = (fresh.sellerSignedAt && fresh.buyerSignedAt) ? "signé_les_deux"
    : fresh.sellerSignedAt ? "signé_vendeur"
    : fresh.buyerSignedAt ? "signé_acheteur"
    : fresh.status;
  const [updated] = await db.update(contractsTable).set({ status: newStatus }).where(eq(contractsTable.id, c.id)).returning();

  // Regenerate PDF with the new signature(s) baked in
  try { await regeneratePdfWithSignatures(updated.id); } catch { /* keep DB record either way */ }

  // Notify the other party
  const otherUserId = isSeller ? tx.buyerId : tx.sellerId;
  const [signer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  createNotification({
    userId: otherUserId,
    type: "transaction_confirmee",
    title: `${signer?.name ?? "L'autre partie"} a signé le bon de commande`,
    body: `Référence ${updated.reference} — signez à votre tour`,
    link: `/transactions/${txId}`,
  }).catch(() => undefined);

  res.json(serializeContract(updated));
});

// GET /api/verify/:reference — public verification
router.get("/verify/:reference", async (req, res): Promise<void> => {
  const reference = String(req.params.reference);
  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.reference, reference));
  if (!c) { res.json({ valid: false, reference }); return; }

  const [row] = await db
    .select({ tx: transactionsTable, offer: residusTable })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .where(eq(transactionsTable.id, c.transactionId));
  if (!row || !row.offer) { res.json({ valid: false, reference }); return; }
  const [seller] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.tx.sellerId));
  const [buyer]  = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.tx.buyerId));

  // Public payload: minimal info — no transaction id, no amount, masked party names.
  const mask = (s: string) => {
    const parts = s.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 1) + "***";
    return parts[0] + " " + parts.slice(1).map((p) => p.slice(0, 1) + ".").join(" ");
  };
  res.json({
    valid: true,
    reference: c.reference,
    seller_name: mask(seller?.name ?? "?"),
    buyer_name: mask(buyer?.name ?? "?"),
    type_residu: row.offer.typeResidu,
    quantity_kg: row.tx.quantityKg,
    generated_at: c.generatedAt.toISOString(),
    signatures_status: {
      seller: !!c.sellerSignedAt,
      buyer: !!c.buyerSignedAt,
      both: !!c.sellerSignedAt && !!c.buyerSignedAt,
    },
    status: c.status,
  });
});

// GET /api/admin/contracts — admin list
router.get("/admin/contracts", requireAuth, async (req, res): Promise<void> => {
  if (!(await isAdmin(req.auth!.userId))) { res.status(403).json({ error: "Accès refusé" }); return; }

  const status = typeof req.query.status === "string" ? String(req.query.status) : null;
  const rows = await db
    .select({
      contract: contractsTable,
      tx: transactionsTable,
      offer: residusTable,
      sellerName: usersTable.name,
    })
    .from(contractsTable)
    .leftJoin(transactionsTable, eq(contractsTable.transactionId, transactionsTable.id))
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .leftJoin(usersTable, eq(transactionsTable.sellerId, usersTable.id));

  const out = rows
    .filter((r) => !status || r.contract.status === status)
    .map((r) => ({
      ...serializeContract(r.contract),
      transaction: r.tx ? {
        id: r.tx.id,
        quantity_kg: r.tx.quantityKg,
        total_fcfa: r.tx.totalFcfa,
        status: r.tx.status,
      } : null,
      type_residu: r.offer?.typeResidu ?? null,
      seller_name: r.sellerName,
    }));

  res.json({
    contracts: out,
    stats: {
      total: out.length,
      ce_mois: out.filter((c) => new Date(c.generated_at).getMonth() === new Date().getMonth() && new Date(c.generated_at).getFullYear() === new Date().getFullYear()).length,
      taux_signature: out.length === 0 ? 0 : out.filter((c) => c.status === "signé_les_deux").length / out.length,
    },
  });
});

export default router;
export { generateContractForTransaction };
