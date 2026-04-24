import { eq, and, sql, gt, lte, desc, inArray } from "drizzle-orm";
import {
  db,
  plansTable,
  subscriptionsTable,
  contactUsageTable,
  subscriptionInvoicesTable,
  usersTable,
  type Plan,
  type Subscription,
} from "@workspace/db";
import { createNotification } from "./notifications";
import { logger } from "./logger";

export type FeatureKey =
  | "contacts_illimites"
  | "alertes_matching"
  | "telechargement_contrats"
  | "filtre_distance"
  | "rapports_filiere"
  | "api_access"
  | "badge_pro"
  | "account_manager";

export function currentMonth(d = new Date()): number {
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

export async function getPlanByName(name: string): Promise<Plan> {
  const [p] = await db.select().from(plansTable).where(eq(plansTable.name, name));
  if (!p) throw new Error(`Plan introuvable: ${name}`);
  return p;
}

/** Returns active subscription (status active or cancelled, still within paid period).
 * Pending validation subscriptions are NEVER returned by this function — features stay locked.
 */
export async function getActiveSubscription(userId: number): Promise<Subscription | null> {
  const [s] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(
      eq(subscriptionsTable.userId, userId),
      inArray(subscriptionsTable.status, ["active", "cancelled"]),
      gt(subscriptionsTable.expiresAt, new Date()),
    ))
    .orderBy(desc(subscriptionsTable.expiresAt))
    .limit(1);
  return s ?? null;
}

/** Returns the user's most recent pending validation subscription, if any. */
export async function getPendingSubscription(userId: number): Promise<Subscription | null> {
  const [s] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(
      eq(subscriptionsTable.userId, userId),
      eq(subscriptionsTable.status, "en_attente_validation"),
    ))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return s ?? null;
}

/** Returns the user's current effective plan. Falls back to gratuit. */
export async function getUserPlan(userId: number): Promise<{ plan: Plan; subscription: Subscription | null }> {
  const sub = await getActiveSubscription(userId);
  if (!sub) {
    const plan = await getPlanByName("gratuit");
    return { plan, subscription: null };
  }
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, sub.planId));
  return { plan: plan!, subscription: sub };
}

export async function checkFeatureAccess(userId: number, feature: FeatureKey): Promise<boolean> {
  const { plan } = await getUserPlan(userId);
  return Boolean(plan.features[feature]);
}

export async function checkContactLimit(userId: number): Promise<{ allowed: boolean; used: number; limit: number; planName: string }> {
  const { plan } = await getUserPlan(userId);
  const month = currentMonth();
  const [{ used }] = await db
    .select({ used: sql<number>`count(*)::int` })
    .from(contactUsageTable)
    .where(and(eq(contactUsageTable.userId, userId), eq(contactUsageTable.month, month)));
  const limit = plan.contactsPerMonth;
  if (limit === -1) return { allowed: true, used: Number(used ?? 0), limit, planName: plan.name };
  return { allowed: Number(used ?? 0) < limit, used: Number(used ?? 0), limit, planName: plan.name };
}

/** Records a contact (idempotent for the same target this month). Returns updated usage. */
export async function recordContact(userId: number, contactedUserId: number): Promise<{ used: number; limit: number }> {
  const month = currentMonth();
  const { plan } = await getUserPlan(userId);
  await db
    .insert(contactUsageTable)
    .values({ userId, contactedUserId, month })
    .onConflictDoNothing({ target: [contactUsageTable.userId, contactUsageTable.contactedUserId, contactUsageTable.month] });
  const [{ used }] = await db
    .select({ used: sql<number>`count(*)::int` })
    .from(contactUsageTable)
    .where(and(eq(contactUsageTable.userId, userId), eq(contactUsageTable.month, month)));
  return { used: Number(used ?? 0), limit: plan.contactsPerMonth };
}

/** Daily cron: expire any active subscriptions whose expires_at passed. */
export async function checkAndExpireSubscriptions(): Promise<void> {
  try {
    const expired = await db
      .update(subscriptionsTable)
      .set({ status: "expired" })
      .where(and(
        eq(subscriptionsTable.status, "active"),
        lte(subscriptionsTable.expiresAt, new Date()),
      ))
      .returning();
    for (const s of expired) {
      await createNotification({
        userId: s.userId,
        type: "broadcast",
        title: "Votre abonnement Pro a expiré",
        body: "Renouvelez pour continuer à profiter des fonctionnalités Pro.",
        link: "/abonnement",
      });
    }
    if (expired.length > 0) logger.info({ count: expired.length }, "Subscriptions expired");
  } catch (err) {
    logger.error({ err }, "checkAndExpireSubscriptions failed");
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PLANS = [
  {
    name: "gratuit",
    label: "Gratuit",
    priceFcfa: 0,
    contactsPerMonth: 5,
    description: "Pour découvrir la plateforme",
    features: {
      contacts_illimites: false, alertes_matching: false, telechargement_contrats: false,
      filtre_distance: false, rapports_filiere: false, api_access: false,
      badge_pro: false, account_manager: false,
    },
    isPopular: false,
  },
  {
    name: "pro",
    label: "Pro",
    priceFcfa: 10000,
    contactsPerMonth: 100,
    description: "Pour les transformateurs en croissance",
    features: {
      contacts_illimites: false, alertes_matching: true, telechargement_contrats: true,
      filtre_distance: true, rapports_filiere: false, api_access: false,
      badge_pro: true, account_manager: false,
    },
    isPopular: true,
  },
  {
    name: "business",
    label: "Business",
    priceFcfa: 25000,
    contactsPerMonth: 999999,
    description: "Pour les grandes structures",
    features: {
      contacts_illimites: true, alertes_matching: true, telechargement_contrats: true,
      filtre_distance: true, rapports_filiere: true, api_access: true,
      badge_pro: true, account_manager: true,
    },
    isPopular: false,
  },
];

/** Idempotent: insert default plans if missing. Existing plans are NOT modified. */
export async function ensureDefaultPlans(): Promise<void> {
  try {
    for (const p of DEFAULT_PLANS) {
      await db.insert(plansTable).values(p).onConflictDoNothing({ target: plansTable.name });
    }
  } catch (err) {
    logger.error({ err }, "ensureDefaultPlans failed");
  }
}

export function startSubscriptionExpiryCron(): void {
  checkAndExpireSubscriptions();
  // Run again at next 00:01, then every 24h
  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 1, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  const wait = next.getTime() - now.getTime();
  setTimeout(() => {
    checkAndExpireSubscriptions();
    setInterval(checkAndExpireSubscriptions, ONE_DAY_MS);
  }, wait);
  logger.info({ nextRunInMs: wait }, "Subscription expiry cron scheduled");
}

export function generateInvoiceReference(date = new Date()): string {
  const year = date.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-AGRL-${year}-${rand}`;
}

export function serializePlan(p: Plan) {
  return {
    id: p.id,
    name: p.name,
    label: p.label,
    price_fcfa: p.priceFcfa,
    contacts_per_month: p.contactsPerMonth,
    features: p.features,
    description: p.description,
    is_popular: p.isPopular,
    is_active: p.isActive,
    updated_at: p.updatedAt?.toISOString?.() ?? null,
    updated_by: p.updatedBy ?? null,
  };
}

export function serializeSubscription(s: Subscription, planName?: string) {
  return {
    id: s.id,
    user_id: s.userId,
    plan_id: s.planId,
    plan_name: planName ?? null,
    status: s.status,
    started_at: s.startedAt.toISOString(),
    expires_at: s.expiresAt.toISOString(),
    payment_reference: s.paymentReference ?? null,
    payment_method: s.paymentMethod,
    renewed_at: s.renewedAt?.toISOString() ?? null,
    cancelled_at: s.cancelledAt?.toISOString() ?? null,
    created_at: s.createdAt.toISOString(),
  };
}

export function serializeInvoice(i: typeof subscriptionInvoicesTable.$inferSelect) {
  return {
    id: i.id,
    subscription_id: i.subscriptionId,
    reference: i.reference,
    amount_fcfa: i.amountFcfa,
    plan_name: i.planName,
    period_start: i.periodStart,
    period_end: i.periodEnd,
    status: i.status,
    payment_method: i.paymentMethod ?? null,
    paid_at: i.paidAt?.toISOString() ?? null,
    pdf_url: i.pdfUrl ?? null,
    created_at: i.createdAt.toISOString(),
  };
}

export async function getAdminUserIds(): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.role, ["admin", "super_admin", "finance"]));
  return rows.map(r => r.id);
}
