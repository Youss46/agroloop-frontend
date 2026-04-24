import { pgTable, serial, integer, text, timestamp, boolean, jsonb, date, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type PlanPriceHistoryEntry = {
  old_price: number;
  new_price: number;
  changed_by: number;
  changed_by_name?: string | null;
  changed_at: string;
  reason: string;
};

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull().default(""),
  priceFcfa: integer("price_fcfa").notNull(),
  contactsPerMonth: integer("contacts_per_month").notNull(),
  features: jsonb("features").notNull().$type<{
    contacts_illimites: boolean;
    alertes_matching: boolean;
    telechargement_contrats: boolean;
    filtre_distance: boolean;
    rapports_filiere: boolean;
    api_access: boolean;
    badge_pro: boolean;
    account_manager: boolean;
  }>(),
  description: text("description").notNull().default(""),
  isPopular: boolean("is_popular").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  priceHistory: jsonb("price_history").notNull().$type<PlanPriceHistoryEntry[]>().default([] as PlanPriceHistoryEntry[]),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  paymentReference: text("payment_reference"),
  paymentMethod: text("payment_method").notNull(),
  paymentProofUrl: text("payment_proof_url"),
  paymentProofFilename: text("payment_proof_filename"),
  paymentProofUploadedAt: timestamp("payment_proof_uploaded_at", { withTimezone: true }),
  renewedAt: timestamp("renewed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactUsageTable = pgTable("contact_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contactedUserId: integer("contacted_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("contact_usage_user_contacted_month_uniq").on(t.userId, t.contactedUserId, t.month),
}));

export const subscriptionInvoicesTable = pgTable("subscription_invoices", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  amountFcfa: integer("amount_fcfa").notNull(),
  planName: text("plan_name").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: text("status").notNull().default("en_attente"),
  paymentMethod: text("payment_method"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type ContactUsage = typeof contactUsageTable.$inferSelect;
export type SubscriptionInvoice = typeof subscriptionInvoicesTable.$inferSelect;
