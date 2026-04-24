import { Router, type IRouter } from "express";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { db, userNotificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { serializeNotification } from "../lib/notifications";

const router: IRouter = Router();

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(userNotificationsTable)
    .where(and(eq(userNotificationsTable.userId, userId), isNull(userNotificationsTable.readAt)));
  res.json({ count: Number(row?.c ?? 0) });
});

const VALID_NOTIF_TYPES = new Set([
  "nouveau_message",
  "offre_correspondante",
  "transaction_confirmee",
  "transaction_annulee",
  "nouvel_avis",
  "offre_expiree",
  "broadcast",
]);

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const unreadOnly = req.query.unread === "true";
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;
  const offset = (page - 1) * limit;

  const whereParts = [eq(userNotificationsTable.userId, userId)];
  if (unreadOnly) whereParts.push(isNull(userNotificationsTable.readAt));
  if (typeof req.query.type === "string") {
    if (!VALID_NOTIF_TYPES.has(req.query.type)) {
      res.status(400).json({ error: "Invalid type filter" });
      return;
    }
    whereParts.push(eq(userNotificationsTable.type, req.query.type as any));
  }

  const rows = await db
    .select()
    .from(userNotificationsTable)
    .where(and(...whereParts))
    .orderBy(desc(userNotificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ c: total } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(userNotificationsTable)
    .where(and(...whereParts));

  res.json({
    items: rows.map(serializeNotification),
    page,
    limit,
    total: Number(total ?? 0),
  });
});

router.put("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  await db.update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(userNotificationsTable.userId, userId), isNull(userNotificationsTable.readAt)));
  res.json({ success: true });
});

router.put("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = req.auth!.userId;
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const [row] = await db.select().from(userNotificationsTable).where(eq(userNotificationsTable.id, id)).limit(1);
  if (!row || row.userId !== userId) { res.status(404).json({ error: "Notification introuvable" }); return; }
  await db.update(userNotificationsTable).set({ readAt: new Date() }).where(eq(userNotificationsTable.id, id));
  res.json({ success: true });
});

router.delete("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = req.auth!.userId;
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const [row] = await db.select().from(userNotificationsTable).where(eq(userNotificationsTable.id, id)).limit(1);
  if (!row || row.userId !== userId) { res.status(404).json({ error: "Notification introuvable" }); return; }
  await db.delete(userNotificationsTable).where(eq(userNotificationsTable.id, id));
  res.json({ success: true });
});

router.delete("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  await db.delete(userNotificationsTable).where(eq(userNotificationsTable.userId, userId));
  res.json({ success: true });
});

export default router;
