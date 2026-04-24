import { db, usersTable, userNotificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { createNotification } from "./notifications";
import { logger } from "./logger";

const ONE_HOUR_MS = 60 * 60 * 1000;

const J1_TITLE = "Pensez à vérifier votre compte";
const J7_TITLE = "Vérification toujours en attente";

function bodyFor(role: string, stage: "j1" | "j7"): { title: string; body: string } {
  const intro = role === "producteur"
    ? "Complétez la vérification de votre compte pour rassurer les transformateurs et accéder à toutes les fonctionnalités."
    : role === "transformateur"
    ? "Complétez la vérification de votre compte pour rassurer les producteurs et accéder à toutes les fonctionnalités."
    : "Complétez la vérification de votre compte pour accéder à toutes les fonctionnalités.";
  if (stage === "j1") {
    return { title: J1_TITLE, body: intro };
  }
  return { title: J7_TITLE, body: intro + " Cela ne prend que quelques minutes." };
}

export async function runVerificationReminderCheck(): Promise<void> {
  try {
    const unverified = await db
      .select({ id: usersTable.id, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(and(
        eq(usersTable.verificationStatus, "non_verifie"),
        sql`${usersTable.createdAt} < NOW() - INTERVAL '23 hours'`,
        sql`${usersTable.createdAt} > NOW() - INTERVAL '9 days'`,
      ));

    const now = Date.now();
    let sent = 0;
    for (const u of unverified) {
      const ageMs = now - new Date(u.createdAt).getTime();
      const ageHours = ageMs / ONE_HOUR_MS;
      let stage: "j1" | "j7" | null = null;
      if (ageHours >= 23 && ageHours < 168) stage = "j1";
      else if (ageHours >= 167 && ageHours < 216) stage = "j7";
      if (!stage) continue;

      const { title, body } = bodyFor(u.role, stage);

      // Stage-specific idempotency: if we've already sent this exact stage title
      // to this user (for verification), skip. This guarantees exactly one J+1 and
      // one J+7 reminder regardless of window overlap.
      const existing = await db
        .select({ id: userNotificationsTable.id })
        .from(userNotificationsTable)
        .where(and(
          eq(userNotificationsTable.userId, u.id),
          eq(userNotificationsTable.type, "broadcast"),
          eq(userNotificationsTable.title, title),
          sql`${userNotificationsTable.link} = '/verification'`,
        ))
        .limit(1);
      if (existing.length > 0) continue;

      await createNotification({
        userId: u.id,
        type: "broadcast",
        title,
        body,
        link: "/verification",
      });
      sent += 1;
    }
    if (sent > 0) {
      logger.info({ count: sent }, "Verification reminders sent");
    }
  } catch (err) {
    logger.error({ err }, "runVerificationReminderCheck failed");
  }
}

export function startVerificationReminderCron(): void {
  runVerificationReminderCheck();
  setInterval(runVerificationReminderCheck, ONE_HOUR_MS);
  logger.info("Verification reminder cron scheduled (hourly)");
}
