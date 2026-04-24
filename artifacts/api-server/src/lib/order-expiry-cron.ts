import { db, orderItemsTable, ordersTable, usersTable, residusTable } from "@workspace/db";
import { eq, and, lt, inArray } from "drizzle-orm";
import { createNotification } from "./notifications";
import { logger } from "./logger";

const ONE_HOUR_MS = 60 * 60 * 1000;
const EXPIRY_MS = 48 * ONE_HOUR_MS;

export async function runOrderExpiryCheck(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - EXPIRY_MS);

    const expired = await db.update(orderItemsTable).set({
      status: "refusée",
      counterNote: "Délai de réponse dépassé — commande automatiquement annulée",
      respondedAt: new Date(),
    }).where(and(
      eq(orderItemsTable.status, "en_attente"),
      lt(orderItemsTable.createdAt, cutoff),
    )).returning();

    if (expired.length === 0) return;

    // Notify transformateurs + recompute order statuses
    const orderIds = Array.from(new Set(expired.map(e => e.orderId)));
    const orders = orderIds.length ? await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds)) : [];
    const orderMap = new Map(orders.map(o => [o.id, o]));

    const offerIds = Array.from(new Set(expired.map(e => e.offreId)));
    const offers = offerIds.length ? await db.select({ id: residusTable.id, typeResidu: residusTable.typeResidu }).from(residusTable).where(inArray(residusTable.id, offerIds)) : [];
    const offerMap = new Map(offers.map(o => [o.id, o]));

    const sellerIds = Array.from(new Set(expired.map(e => e.producteurId)));
    const sellers = sellerIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, sellerIds)) : [];
    const sellerMap = new Map(sellers.map(s => [s.id, s]));

    for (const item of expired) {
      const order = orderMap.get(item.orderId);
      if (!order) continue;
      const seller = sellerMap.get(item.producteurId);
      const offer = offerMap.get(item.offreId);
      await createNotification({
        userId: order.transformateurId,
        type: "offre_expiree",
        title: "⏰ Commande expirée",
        body: `${seller?.name ?? "Le vendeur"} n'a pas répondu à temps pour ${offer?.typeResidu ?? "la commande"}. L'article a été annulé.`,
        link: `/commandes/${order.id}`,
      });
    }

    // Recompute order status for each affected order
    for (const orderId of orderIds) {
      const items = await db.select({ status: orderItemsTable.status }).from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
      if (items.length === 0) continue;
      const pending = items.filter(i => i.status === "en_attente" || i.status === "contre_proposée").length;
      const refused = items.filter(i => i.status === "refusée").length;
      let newStatus: "en_attente" | "partiellement_confirmée" | "confirmée" | "annulée";
      if (refused === items.length) newStatus = "annulée";
      else if (pending === 0) newStatus = "confirmée";
      else if (pending === items.length) newStatus = "en_attente";
      else newStatus = "partiellement_confirmée";
      await db.update(ordersTable).set({ status: newStatus, updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
    }

    logger.info({ expired: expired.length }, "Expired order items processed");
  } catch (err) {
    logger.error({ err }, "runOrderExpiryCheck failed");
  }
}

export function startOrderExpiryCron(): void {
  runOrderExpiryCheck();
  setInterval(runOrderExpiryCheck, ONE_HOUR_MS);
  logger.info({ intervalMs: ONE_HOUR_MS }, "Order expiry cron scheduled");
}
