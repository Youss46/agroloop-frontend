import { db, residusTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { createNotification } from "./notifications";
import { logger } from "./logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function runExpiryCheck(): Promise<void> {
  try {
    const expired = await db
      .update(residusTable)
      .set({ status: "expiré" })
      .where(and(
        eq(residusTable.status, "disponible"),
        sql`${residusTable.createdAt} < NOW() - INTERVAL '7 days'`,
      ))
      .returning();

    for (const off of expired) {
      await createNotification({
        userId: off.userId,
        type: "offre_expiree",
        title: "Offre expirée",
        body: `Votre offre ${off.typeResidu} a expiré. Renouvelez-la.`,
        link: `/dashboard/producteur`,
      });
    }
    if (expired.length > 0) {
      logger.info({ count: expired.length }, "Expired offers processed");
    }
  } catch (err) {
    logger.error({ err }, "runExpiryCheck failed");
  }
}

function msUntilNext8AM(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(8, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startExpiryCron(): void {
  // Run a check at startup, then schedule next 08:00, then every 24h.
  runExpiryCheck();
  const wait = msUntilNext8AM();
  setTimeout(() => {
    runExpiryCheck();
    setInterval(runExpiryCheck, ONE_DAY_MS);
  }, wait);
  logger.info({ nextRunInMs: wait }, "Expiry cron scheduled");
}
