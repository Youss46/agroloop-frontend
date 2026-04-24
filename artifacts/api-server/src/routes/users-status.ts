import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function statusLabel(lastSeen: Date | null, isOnline: boolean): string {
  if (isOnline) return "En ligne";
  if (!lastSeen) return "Hors ligne";
  const now = Date.now();
  const diffMs = now - lastSeen.getTime();
  const min = Math.floor(diffMs / 60_000);
  const h = Math.floor(diffMs / 3_600_000);
  const d = Math.floor(diffMs / 86_400_000);
  if (min < 60) return `Vu il y a ${Math.max(1, min)} min`;
  if (h < 24) return `Vu il y a ${h}h`;
  if (d < 7) return `Vu il y a ${d} jour${d > 1 ? "s" : ""}`;
  return "Vu il y a plus d'une semaine";
}

router.get("/users/:id/status", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID invalide" }); return; }
  const [u] = await db.select({
    lastSeen: usersTable.lastSeen,
    showOnlineStatus: usersTable.showOnlineStatus,
  }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!u) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  if (!u.showOnlineStatus) {
    res.json({ is_online: false, last_seen: null, status_label: "Hors ligne" });
    return;
  }
  const now = Date.now();
  const ls = u.lastSeen ? new Date(u.lastSeen) : null;
  const isOnline = !!ls && (now - ls.getTime()) < 3 * 60_000;
  res.json({
    is_online: isOnline,
    last_seen: ls ? ls.toISOString() : null,
    status_label: statusLabel(ls, isOnline),
  });
});

router.patch("/users/me/online-status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const { showOnlineStatus } = req.body ?? {};
  if (typeof showOnlineStatus !== "boolean") { res.status(400).json({ error: "showOnlineStatus (boolean) requis" }); return; }
  await db.update(usersTable).set({ showOnlineStatus }).where(eq(usersTable.id, userId));
  res.json({ showOnlineStatus });
});

router.get("/users/me/online-status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [u] = await db.select({ showOnlineStatus: usersTable.showOnlineStatus })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  res.json({ showOnlineStatus: u?.showOnlineStatus ?? true });
});

export default router;
