import { db, devisTable, usersTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { createNotification } from "./notifications";
import { logger } from "./logger";

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function runDevisExpiryCheck(): Promise<void> {
  try {
    // Expire en_attente → notify buyer (producer never responded)
    const expiredInitial = await db
      .update(devisTable)
      .set({ status: "expiré", updatedAt: new Date() })
      .where(and(
        eq(devisTable.status, "en_attente"),
        lt(devisTable.expiresAt, new Date()),
      ))
      .returning();

    for (const d of expiredInitial) {
      const [producer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, d.producteurId));
      await createNotification({
        userId: d.transformateurId,
        type: "offre_expiree",
        title: "⏰ Devis expiré",
        body: `${producer?.name ?? "Le vendeur"} n'a pas répondu dans les délais.`,
        link: `/devis/${d.id}`,
      });
    }

    // Expire contre_proposé → notify seller (buyer never responded to counter)
    const expiredCounter = await db
      .update(devisTable)
      .set({ status: "expiré", updatedAt: new Date() })
      .where(and(
        eq(devisTable.status, "contre_proposé"),
        lt(devisTable.expiresAt, new Date()),
      ))
      .returning();

    for (const d of expiredCounter) {
      const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, d.transformateurId));
      await createNotification({
        userId: d.producteurId,
        type: "offre_expiree",
        title: "⏰ Contre-proposition expirée",
        body: `${buyer?.name ?? "L'acheteur"} n'a pas répondu à votre contre-proposition dans les délais.`,
        link: `/devis/${d.id}`,
      });
    }

    const total = expiredInitial.length + expiredCounter.length;
    if (total > 0) {
      logger.info({ initial: expiredInitial.length, counter: expiredCounter.length }, "Expired devis processed");
    }
  } catch (err) {
    logger.error({ err }, "runDevisExpiryCheck failed");
  }
}

export function startDevisExpiryCron(): void {
  runDevisExpiryCheck();
  setInterval(runDevisExpiryCheck, ONE_HOUR_MS);
  logger.info({ intervalMs: ONE_HOUR_MS }, "Devis expiry cron scheduled");
}
