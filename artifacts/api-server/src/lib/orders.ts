import crypto from "node:crypto";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderReference(date = new Date()): string {
  const year = date.getFullYear();
  const bytes = crypto.randomBytes(4);
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length];
  return `CMD-AGRL-${year}-${suffix}`;
}

export async function generateUniqueOrderReference(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const ref = generateOrderReference();
    const [coll] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.reference, ref));
    if (!coll) return ref;
  }
  return generateOrderReference() + "-" + Date.now().toString(36).toUpperCase();
}

export const ORDER_EXPIRY_MS = 48 * 60 * 60 * 1000;
