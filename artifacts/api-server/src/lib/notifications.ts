import { db, userNotificationsTable, userPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { io } from "./socket";
import { logger } from "./logger";

export type NotifType =
  | "nouveau_message"
  | "offre_correspondante"
  | "transaction_confirmee"
  | "transaction_annulee"
  | "nouvel_avis"
  | "offre_expiree"
  | "broadcast"
  | "support";

export interface CreateNotificationInput {
  userId: number;
  type: NotifType;
  title: string;
  body: string;
  link?: string | null;
}

function serializeNotification(n: any) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

async function shouldNotify(userId: number, type: NotifType): Promise<boolean> {
  // broadcast and offre_expiree always go through (system messages)
  if (type === "broadcast" || type === "offre_expiree") return true;
  const [pref] = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId))
    .limit(1);
  if (!pref) return true; // default ON
  switch (type) {
    case "nouveau_message": return pref.notifNouveauMessage;
    case "offre_correspondante": return pref.notifOffreMatch;
    case "transaction_confirmee":
    case "transaction_annulee": return pref.notifTransaction;
    case "nouvel_avis": return pref.notifAvis;
    default: return true;
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const allowed = await shouldNotify(input.userId, input.type);
    if (!allowed) return;
    const [row] = await db.insert(userNotificationsTable).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    }).returning();
    if (io) {
      io.to(`user:${input.userId}`).emit("new_notification", serializeNotification(row));
    }
  } catch (err) {
    logger.error({ err, input }, "createNotification failed");
  }
}

export { serializeNotification };
