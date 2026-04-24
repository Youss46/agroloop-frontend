import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const verificationStatusEnum = pgEnum("verification_request_status", [
  "en_attente",
  "approuvée",
  "rejetée",
]);

export const verificationLevelEnum = pgEnum("verification_level", [
  "identite",
  "professionnel",
]);

export const verificationDocumentTypeEnum = pgEnum("verification_document_type", [
  "cni",
  "passeport",
  "carte_cooperative",
  "photo_parcelle",
  "rccm",
  "attestation_fiscale",
]);

export const userVerificationStatusEnum = pgEnum("user_verification_status", [
  "non_verifie",
  "en_attente",
  "identite_verifie",
  "professionnel_verifie",
]);

export const verificationRequestsTable = pgTable("verification_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: verificationStatusEnum("status").notNull().default("en_attente"),
  level: verificationLevelEnum("level").notNull(),
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationDocumentsTable = pgTable("verification_documents", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => verificationRequestsTable.id, { onDelete: "cascade" }),
  documentType: verificationDocumentTypeEnum("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VerificationRequest = typeof verificationRequestsTable.$inferSelect;
export type VerificationDocument = typeof verificationDocumentsTable.$inferSelect;
