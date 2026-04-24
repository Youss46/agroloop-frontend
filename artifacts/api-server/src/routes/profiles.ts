import { Router, type IRouter } from "express";
import { eq, or, and, sql, desc, ne } from "drizzle-orm";
import { db, usersTable, transactionsTable, ratingsTable, residusTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { serializeUser } from "../lib/serialize-user";

const router: IRouter = Router();

const FILIERES_ALLOWED = new Set([
  "Cacao", "Anacarde", "Plantain", "Manioc", "Riz", "Hévéa",
  "Palmier à huile", "Maïs", "Igname", "Autre",
]);

const MAX_BIO = 300;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

router.put("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const body = req.body ?? {};
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (v.length < 2) { res.status(400).json({ error: "Le nom doit contenir au moins 2 caractères" }); return; }
    update.name = v.slice(0, 120);
  }
  if (body.bio !== undefined) {
    if (body.bio === null || body.bio === "") {
      update.bio = null;
    } else if (typeof body.bio === "string") {
      if (body.bio.length > MAX_BIO) {
        res.status(400).json({ error: `Bio trop longue (max ${MAX_BIO} caractères)` });
        return;
      }
      update.bio = body.bio;
    }
  }
  if (body.region !== undefined) {
    update.region = body.region === null || body.region === "" ? null : String(body.region).slice(0, 80);
  }
  if (body.phone !== undefined) {
    update.phone = body.phone === null || body.phone === "" ? null : String(body.phone).slice(0, 40);
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      update.avatarUrl = null;
    } else {
      // Reuse same validation as /users/avatar to prevent bypass.
      const v = String(body.avatarUrl);
      if (!v.startsWith("data:image/")) {
        res.status(400).json({ error: "avatarUrl invalide (data:image/...)" });
        return;
      }
      const commaIdx = v.indexOf(",");
      const b64 = commaIdx >= 0 ? v.slice(commaIdx + 1) : "";
      const approxBytes = Math.floor((b64.length * 3) / 4);
      if (approxBytes > MAX_AVATAR_BYTES) {
        res.status(400).json({ error: "Image trop volumineuse (max 2 Mo)" });
        return;
      }
      update.avatarUrl = v;
    }
  }
  if (body.filieres !== undefined) {
    if (!Array.isArray(body.filieres)) {
      res.status(400).json({ error: "filieres doit être un tableau" });
      return;
    }
    const items = body.filieres.map((f: unknown) => String(f));
    const invalid = items.filter((f: string) => !FILIERES_ALLOWED.has(f));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Filière(s) inconnue(s): ${invalid.join(", ")}` });
      return;
    }
    update.filieres = Array.from(new Set(items));
  }

  const [updated] = await db
    .update(usersTable)
    .set(update)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  res.json(serializeUser(updated));
});

router.post("/users/avatar", requireAuth, async (req, res): Promise<void> => {
  const dataUrl = req.body?.dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Image base64 invalide (data:image/...)" });
    return;
  }
  // Approximate decoded size: base64 is 4/3 of binary
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : "";
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > MAX_AVATAR_BYTES) {
    res.status(400).json({ error: "Image trop volumineuse (max 2 Mo)" });
    return;
  }
  // Store base64 directly (Cloudinary not configured).
  await db
    .update(usersTable)
    .set({ avatarUrl: dataUrl })
    .where(eq(usersTable.id, req.auth!.userId));
  res.json({ avatarUrl: dataUrl });
});

router.get("/users/:userId/profile", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  // Confirmed transactions stats
  const [stats] = await db
    .select({
      totalKg: sql<number>`COALESCE(SUM(${transactionsTable.quantityKg})::int, 0)`,
      totalTx: sql<number>`COUNT(*)::int`,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.status, "confirmée"),
      or(
        eq(transactionsTable.buyerId, userId),
        eq(transactionsTable.sellerId, userId),
      ),
    ));

  // Producteur-only stats: total offres, distinct types
  let totalOffresPubliees = 0;
  let totalResidusTypes = 0;
  let activeOffres: any[] = [];
  if (user.role === "producteur") {
    const [oStats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        types: sql<number>`COUNT(DISTINCT ${residusTable.typeResidu})::int`,
      })
      .from(residusTable)
      .where(eq(residusTable.userId, userId));
    totalOffresPubliees = Number(oStats?.total ?? 0);
    totalResidusTypes = Number(oStats?.types ?? 0);

    activeOffres = await db
      .select({
        id: residusTable.id,
        typeResidu: residusTable.typeResidu,
        quantityKg: residusTable.quantityKg,
        priceFcfa: residusTable.priceFcfa,
        region: residusTable.region,
      })
      .from(residusTable)
      .where(and(eq(residusTable.userId, userId), eq(residusTable.status, "disponible")))
      .orderBy(desc(residusTable.createdAt))
      .limit(5);
  }

  const ratings = await db
    .select({
      id: ratingsTable.id,
      transactionId: ratingsTable.transactionId,
      reviewerId: ratingsTable.reviewerId,
      revieweeId: ratingsTable.revieweeId,
      stars: ratingsTable.stars,
      comment: ratingsTable.comment,
      createdAt: ratingsTable.createdAt,
      reviewerName: usersTable.name,
      offerTitle: residusTable.typeResidu,
    })
    .from(ratingsTable)
    .leftJoin(usersTable, eq(ratingsTable.reviewerId, usersTable.id))
    .leftJoin(transactionsTable, eq(ratingsTable.transactionId, transactionsTable.id))
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .where(eq(ratingsTable.revieweeId, userId))
    .orderBy(desc(ratingsTable.createdAt))
    .limit(20);

  // suppress unused-import warning
  void ne;

  res.json({
    id: user.id,
    name: user.name,
    role: user.role,
    region: user.region,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    filieres: Array.isArray(user.filieres) ? user.filieres : [],
    createdAt: user.createdAt.toISOString(),
    ratingAvg: Number(user.ratingAvg ?? 0),
    ratingCount: user.ratingCount ?? 0,
    totalKgTraded: Number(stats?.totalKg ?? 0),
    totalTransactions: Number(stats?.totalTx ?? 0),
    totalOffresPubliees,
    totalResidusTypes,
    activeOffres: activeOffres.map(o => ({
      id: o.id,
      typeResidu: o.typeResidu,
      quantityKg: o.quantityKg,
      priceFcfa: o.priceFcfa,
      region: o.region ?? null,
    })),
    ratings: ratings.map(r => ({
      id: r.id,
      transactionId: r.transactionId,
      reviewerId: r.reviewerId,
      revieweeId: r.revieweeId,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      reviewerName: r.reviewerName ?? "Anonyme",
      offerTitle: r.offerTitle ?? "Offre",
    })),
  });
});

export default router;
