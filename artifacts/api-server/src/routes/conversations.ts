import { Router, type IRouter } from "express";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, residusTable, usersTable, conversionEventsTable } from "@workspace/db";
import { CreateConversationBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { checkContactLimit, recordContact } from "../lib/subscriptions";

const router: IRouter = Router();

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const role = req.auth!.role;

  const isProducteur = role === "producteur";
  const myCol = isProducteur ? conversationsTable.producteurId : conversationsTable.transformateurId;
  const otherCol = isProducteur ? conversationsTable.transformateurId : conversationsTable.producteurId;

  const rows = await db
    .select({
      id: conversationsTable.id,
      offerId: conversationsTable.offerId,
      producteurId: conversationsTable.producteurId,
      transformateurId: conversationsTable.transformateurId,
      createdAt: conversationsTable.createdAt,
      offerTitle: residusTable.typeResidu,
      otherPartyName: usersTable.name,
      otherPartyId: otherCol,
      otherPartyRatingAvg: usersTable.ratingAvg,
      otherPartyRatingCount: usersTable.ratingCount,
    })
    .from(conversationsTable)
    .leftJoin(residusTable, eq(conversationsTable.offerId, residusTable.id))
    .leftJoin(usersTable, eq(otherCol, usersTable.id))
    .where(eq(myCol, userId))
    .orderBy(desc(conversationsTable.createdAt));

  const result = await Promise.all(rows.map(async (r) => {
    const [last] = await db
      .select({ content: messagesTable.content, createdAt: messagesTable.createdAt })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, r.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    const [unread] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.conversationId, r.id),
        sql`${messagesTable.senderId} != ${userId}`,
        sql`${messagesTable.readAt} IS NULL`,
      ));

    return {
      id: r.id,
      offerId: r.offerId,
      producteurId: r.producteurId,
      transformateurId: r.transformateurId,
      createdAt: r.createdAt.toISOString(),
      offerTitle: r.offerTitle ?? "Offre supprimée",
      otherPartyName: r.otherPartyName ?? "Inconnu",
      otherPartyId: r.otherPartyId,
      otherPartyRatingAvg: Number(r.otherPartyRatingAvg ?? 0),
      otherPartyRatingCount: r.otherPartyRatingCount ?? 0,
      lastMessage: last?.content ?? null,
      lastMessageAt: last?.createdAt?.toISOString() ?? null,
      unreadCount: Number(unread?.c ?? 0),
    };
  }));

  res.json(result);
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.auth!.userId;
  const role = req.auth!.role;

  if (role !== "transformateur") {
    res.status(403).json({ error: "Seul un transformateur peut démarrer une conversation" });
    return;
  }

  const [offer] = await db.select().from(residusTable).where(eq(residusTable.id, parsed.data.offerId));
  if (!offer) {
    res.status(400).json({ error: "Offre introuvable" });
    return;
  }

  // Check existing
  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(and(
      eq(conversationsTable.offerId, parsed.data.offerId),
      eq(conversationsTable.transformateurId, userId),
    ));

  let conv = existing;
  if (!conv) {
    // Enforce monthly contact limit for free transformateurs
    const limitCheck = await checkContactLimit(userId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        error: "CONTACT_LIMIT_REACHED",
        message: `Vous avez atteint votre limite de ${limitCheck.limit} contacts ce mois-ci`,
        used: limitCheck.used,
        limit: limitCheck.limit,
        plan: limitCheck.planName,
        upgrade_url: "/abonnement",
      });
      return;
    }
    [conv] = await db.insert(conversationsTable).values({
      offerId: parsed.data.offerId,
      producteurId: offer.userId,
      transformateurId: userId,
    }).returning();
    await recordContact(userId, offer.userId);

    // Track first_contact conversion (fire-and-forget)
    db.select({ c: sql<number>`count(*)::int` })
      .from(conversationsTable)
      .where(eq(conversationsTable.transformateurId, userId))
      .then(([row]) => {
        if ((row?.c ?? 0) <= 1) {
          const sessionId = (req as any).analyticsSessionId ?? "unknown";
          return db.insert(conversionEventsTable).values({
            eventType: "first_contact",
            userId,
            sessionId,
          });
        }
      })
      .catch(() => { /* ignore */ });
  }

  const [producteur] = await db
    .select({
      name: usersTable.name,
      ratingAvg: usersTable.ratingAvg,
      ratingCount: usersTable.ratingCount,
    })
    .from(usersTable)
    .where(eq(usersTable.id, offer.userId));

  res.json({
    id: conv.id,
    offerId: conv.offerId,
    producteurId: conv.producteurId,
    transformateurId: conv.transformateurId,
    createdAt: conv.createdAt.toISOString(),
    offerTitle: offer.typeResidu,
    otherPartyName: producteur?.name ?? "Inconnu",
    otherPartyId: offer.userId,
    otherPartyRatingAvg: Number(producteur?.ratingAvg ?? 0),
    otherPartyRatingCount: producteur?.ratingCount ?? 0,
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: 0,
  });
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const page = Math.max(1, Number(req.query.page ?? 1));
  const PAGE_SIZE = 30;
  const userId = req.auth!.userId;

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation introuvable" });
    return;
  }
  if (conv.producteurId !== userId && conv.transformateurId !== userId) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE).reverse();

  res.json({
    messages: pageRows.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    page,
    hasMore,
  });
});

router.put("/messages/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const userId = req.auth!.userId;

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!msg) {
    res.status(404).json({ error: "Message introuvable" });
    return;
  }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.conversationId));
  if (!conv || (conv.producteurId !== userId && conv.transformateurId !== userId)) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  if (msg.senderId === userId) {
    res.status(403).json({ error: "Vous ne pouvez pas marquer vos propres messages" });
    return;
  }

  const [updated] = await db.update(messagesTable)
    .set({ readAt: msg.readAt ?? new Date() })
    .where(eq(messagesTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    conversationId: updated.conversationId,
    senderId: updated.senderId,
    content: updated.content,
    readAt: updated.readAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
