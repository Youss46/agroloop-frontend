import { pgTable, serial, integer, text, timestamp, pgEnum, boolean, uniqueIndex, index, AnyPgColumn } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "ouvert",
  "en_cours",
  "resolu",
  "ferme",
  "spam",
  "doublon",
]);

export const supportTicketCategoryEnum = pgEnum("support_ticket_category", [
  "compte",
  "verification",
  "paiement",
  "offre",
  "commande",
  "technique",
  "autre",
]);

export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", [
  "normale",
  "haute",
  "urgente",
]);

// New: configurable categories (replaces hard-coded enum at the data level).
export const supportCategoriesTable = pgTable("support_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#6b7280"),
  icon: text("icon").notNull().default("💬"),
  slaHours: integer("sla_hours").notNull().default(12),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  reference: text("reference").unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  category: supportTicketCategoryEnum("category").notNull().default("autre"),
  categoryId: integer("category_id").references(() => supportCategoriesTable.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  status: supportTicketStatusEnum("status").notNull().default("ouvert"),
  priority: supportTicketPriorityEnum("priority").notNull().default("normale"),
  adminResponse: text("admin_response"),
  handledByAdminId: integer("handled_by_admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  assignedTo: integer("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  mergedInto: integer("merged_into").references((): AnyPgColumn => supportTicketsTable.id, { onDelete: "set null" }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  slaDeadline: timestamp("sla_deadline", { withTimezone: true }),
  slaBreached: boolean("sla_breached").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("support_tickets_status_idx").on(t.status),
  categoryIdIdx: index("support_tickets_category_id_idx").on(t.categoryId),
  assignedToIdx: index("support_tickets_assigned_to_idx").on(t.assignedTo),
  slaDeadlineIdx: index("support_tickets_sla_deadline_idx").on(t.slaDeadline),
}));

export const supportRepliesTable = pgTable("support_replies", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isInternalNote: boolean("is_internal_note").notNull().default(false),
  isTemplateReply: boolean("is_template_reply").notNull().default(false),
  notificationSent: boolean("notification_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index("support_replies_ticket_idx").on(t.ticketId),
}));

export const supportTemplatesTable = pgTable("support_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  categoryId: integer("category_id").references(() => supportCategoriesTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTicketHistoryTable = pgTable("support_ticket_history", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(), // status_change, assign, priority, merge, reopen, etc.
  fromValue: text("from_value"),
  toValue: text("to_value"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index("support_ticket_history_ticket_idx").on(t.ticketId),
}));

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type SupportCategory = typeof supportCategoriesTable.$inferSelect;
export type SupportReply = typeof supportRepliesTable.$inferSelect;
export type SupportTemplate = typeof supportTemplatesTable.$inferSelect;
export type SupportTicketHistory = typeof supportTicketHistoryTable.$inferSelect;
