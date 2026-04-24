import { Router, type IRouter } from "express";
import { eq, and, sql, desc, isNull, ne } from "drizzle-orm";
import { db, ratingsTable, transactionsTable, usersTable, residusTable } from "@workspace/db";
import { CreateRatingBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

router.post("/ratings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRatingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { transactionId, stars, comment } = parsed.data;
  const reviewerId = req.auth!.userId;

  if (stars < 1 || stars > 5) {
    res.status(400).json({ error: "Note invalide (1-5)" });
    return;
  }

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, transactionId));
  if (!tx) {
    res.status(400).json({ error: "Transaction introuvable" });
    return;
  }
  if (tx.status !== "confirmée") {
    res.status(400).json({ error: "La transaction doit être confirmée" });
    return;
  }
  if (tx.buyerId !== reviewerId && tx.sellerId !== reviewerId) {
    res.status(403).json({ error: "Vous n'êtes pas partie à cette transaction" });
    return;
  }

  const revieweeId = tx.buyerId === reviewerId ? tx.sellerId : tx.buyerId;

  let rating;
  try {
    rating = await db.transaction(async (trx) => {
      const [inserted] = await trx.insert(ratingsTable).values({
        transactionId,
        reviewerId,
        revieweeId,
        stars,
        comment: comment ?? null,
      }).returning();

      const [agg] = await trx
        .select({
          avg: sql<string>`COALESCE(AVG(${ratingsTable.stars})::numeric(2,1), 0.0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(ratingsTable)
        .where(eq(ratingsTable.revieweeId, revieweeId));

      await trx.update(usersTable)
        .set({
          ratingAvg: String(agg?.avg ?? "0.0"),
          ratingCount: Number(agg?.count ?? 0),
        })
        .where(eq(usersTable.id, revieweeId));

      return inserted;
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Vous avez déjà noté cette transaction" });
      return;
    }
    throw err;
  }

  res.status(201).json({
    id: rating.id,
    transactionId: rating.transactionId,
    reviewerId: rating.reviewerId,
    revieweeId: rating.revieweeId,
    stars: rating.stars,
    comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
  });

  createNotification({
    userId: revieweeId,
    type: "nouvel_avis",
    title: `Vous avez reçu un avis ${stars}⭐`,
    body: (comment ?? "").slice(0, 60) || "Un nouvel avis vient d'être publié sur votre profil.",
    link: `/profil/${revieweeId}`,
  }).catch(() => undefined);
});

router.get("/ratings/user/:userId", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const rows = await db
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
    .orderBy(desc(ratingsTable.createdAt));

  res.json(rows.map(r => ({
    id: r.id,
    transactionId: r.transactionId,
    reviewerId: r.reviewerId,
    revieweeId: r.revieweeId,
    stars: r.stars,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    reviewerName: r.reviewerName ?? "Anonyme",
    offerTitle: r.offerTitle ?? "Offre",
  })));
});

router.get("/ratings/pending", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;

  // Confirmed transactions where I'm a party AND I haven't rated yet
  const rows = await db
    .select({
      transactionId: transactionsTable.id,
      buyerId: transactionsTable.buyerId,
      sellerId: transactionsTable.sellerId,
      quantityKg: transactionsTable.quantityKg,
      totalFcfa: transactionsTable.totalFcfa,
      createdAt: transactionsTable.createdAt,
      offerTitle: residusTable.typeResidu,
      buyerName: sql<string>`buyer.name`,
      sellerName: sql<string>`seller.name`,
      myRatingId: ratingsTable.id,
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .leftJoin(sql`${usersTable} as buyer`, sql`buyer.id = ${transactionsTable.buyerId}`)
    .leftJoin(sql`${usersTable} as seller`, sql`seller.id = ${transactionsTable.sellerId}`)
    .leftJoin(ratingsTable, and(
      eq(ratingsTable.transactionId, transactionsTable.id),
      eq(ratingsTable.reviewerId, userId),
    ))
    .where(and(
      eq(transactionsTable.status, "confirmée"),
      sql`(${transactionsTable.buyerId} = ${userId} OR ${transactionsTable.sellerId} = ${userId})`,
      isNull(ratingsTable.id),
    ))
    .orderBy(desc(transactionsTable.createdAt));

  const result = rows.map(r => {
    const isBuyer = r.buyerId === userId;
    return {
      transactionId: r.transactionId,
      otherPartyId: isBuyer ? r.sellerId : r.buyerId,
      otherPartyName: (isBuyer ? r.sellerName : r.buyerName) ?? "Inconnu",
      offerTitle: r.offerTitle ?? "Offre",
      quantityKg: r.quantityKg,
      totalFcfa: r.totalFcfa,
      confirmedAt: r.createdAt.toISOString(),
    };
  });

  res.json(result);
});

export default router;
