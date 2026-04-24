import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import {
  db,
  paymentSettingsTable,
  adminLogsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";

const isStr = (v: unknown, max = 500): v is string =>
  typeof v === "string" && v.length <= max;

const router: IRouter = Router();

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.get("/payment-settings", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      method: paymentSettingsTable.method,
      label: paymentSettingsTable.label,
      account_name: paymentSettingsTable.accountName,
      number: paymentSettingsTable.number,
      instructions: paymentSettingsTable.instructions,
      position: paymentSettingsTable.position,
    })
    .from(paymentSettingsTable)
    .where(eq(paymentSettingsTable.isActive, true))
    .orderBy(asc(paymentSettingsTable.position));
  res.json(rows);
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────
router.use("/admin/payment-settings", requireAuth, requireAdmin);

router.get("/admin/payment-settings", requirePermission("payment_settings", "view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: paymentSettingsTable.id,
      method: paymentSettingsTable.method,
      label: paymentSettingsTable.label,
      account_name: paymentSettingsTable.accountName,
      number: paymentSettingsTable.number,
      instructions: paymentSettingsTable.instructions,
      is_active: paymentSettingsTable.isActive,
      position: paymentSettingsTable.position,
      updated_at: paymentSettingsTable.updatedAt,
      updated_by: paymentSettingsTable.updatedBy,
      updated_by_name: usersTable.name,
    })
    .from(paymentSettingsTable)
    .leftJoin(usersTable, eq(paymentSettingsTable.updatedBy, usersTable.id))
    .orderBy(asc(paymentSettingsTable.position));
  res.json(rows);
});

const PHONE_METHODS = new Set(["orange_money", "wave", "mtn_money"]);
const PHONE_RE = /^\+225 ?\d{2} ?\d{2} ?\d{2} ?\d{2} ?\d{2}$/;
const ALLOWED_METHODS = new Set(["orange_money", "wave", "mtn_money", "virement", "autre"]);

router.post("/admin/payment-settings", requirePermission("payment_settings", "edit"), async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  if (
    !isStr(b.method, 32) || !ALLOWED_METHODS.has(b.method) ||
    !isStr(b.label, 80) || !b.label.trim() ||
    !isStr(b.account_name, 120) || !b.account_name.trim() ||
    !isStr(b.number, 200) ||
    typeof b.is_active !== "boolean" ||
    (b.instructions != null && !isStr(b.instructions))
  ) {
    res.status(400).json({ error: "Champs invalides" }); return;
  }
  const method = b.method as string;
  const number = (b.number as string).trim();
  if (b.is_active && !number) { res.status(400).json({ error: "Le numéro est requis pour un mode actif." }); return; }
  if (b.is_active && PHONE_METHODS.has(method) && !PHONE_RE.test(number)) {
    res.status(400).json({ error: "Numéro Côte d'Ivoire invalide (format: +225 XX XX XX XX XX)." }); return;
  }
  const existing = await db.select({ id: paymentSettingsTable.id }).from(paymentSettingsTable).where(eq(paymentSettingsTable.method, method));
  if (existing.length > 0) { res.status(409).json({ error: "Ce mode de paiement existe déjà." }); return; }
  const [{ maxPos = 0 } = { maxPos: 0 }] = await db.select({ maxPos: sql<number>`coalesce(max(${paymentSettingsTable.position}),0)::int` }).from(paymentSettingsTable);
  try {
    const [created] = await db.insert(paymentSettingsTable).values({
      method,
      label: (b.label as string).trim(),
      accountName: (b.account_name as string).trim(),
      number,
      instructions: (b.instructions as string | null | undefined)?.toString().trim() || null,
      isActive: b.is_active as boolean,
      position: (maxPos ?? 0) + 1,
      updatedBy: req.auth!.userId,
    }).returning();
    await db.insert(adminLogsTable).values({
      adminId: req.auth!.userId,
      action: "create_payment_setting",
      targetType: "broadcast",
      targetId: created!.id,
      details: { method, label: created!.label },
    });
    res.status(201).json({ success: true, setting: created });
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "Ce mode de paiement existe déjà." }); return; }
    throw e;
  }
});

router.delete("/admin/payment-settings/:id", requirePermission("payment_settings", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  const [current] = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.id, id));
  if (!current) { res.status(404).json({ error: "Mode de paiement introuvable" }); return; }
  if (current.isActive) {
    const activeCount = (await db.select({ c: sql<number>`count(*)::int` })
      .from(paymentSettingsTable).where(eq(paymentSettingsTable.isActive, true)))[0]?.c ?? 0;
    if (activeCount <= 1) { res.status(400).json({ error: "Vous devez conserver au moins un mode de paiement actif." }); return; }
  }
  await db.delete(paymentSettingsTable).where(eq(paymentSettingsTable.id, id));
  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: "delete_payment_setting",
    targetType: "broadcast",
    targetId: id,
    details: { method: current.method, label: current.label },
  });
  res.json({ deleted: true });
});

router.put("/admin/payment-settings/reorder", requirePermission("payment_settings", "edit"), async (req, res): Promise<void> => {
  const ids = (req.body as { ordered_ids?: unknown }).ordered_ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
    res.status(400).json({ error: "ordered_ids invalide" }); return;
  }
  const intIds = ids as number[];
  await db.transaction(async (tx) => {
    for (let i = 0; i < intIds.length; i++) {
      await tx.update(paymentSettingsTable)
        .set({ position: i + 1, updatedAt: new Date(), updatedBy: req.auth!.userId })
        .where(eq(paymentSettingsTable.id, intIds[i]!));
    }
  });
  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: "reorder_payment_settings",
    targetType: "broadcast",
    targetId: null,
    details: { ordered_ids: intIds },
  });
  res.json({ success: true });
});

router.put("/admin/payment-settings/:id", requirePermission("payment_settings", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "id invalide" }); return; }
  const b = req.body as Record<string, unknown>;
  if (
    !isStr(b.label, 80) || !b.label.trim() ||
    !isStr(b.account_name, 120) || !b.account_name.trim() ||
    !isStr(b.number, 200) ||
    typeof b.is_active !== "boolean" ||
    (b.instructions != null && !isStr(b.instructions)) ||
    (b.position !== undefined && !(Number.isInteger(b.position) && (b.position as number) >= 0))
  ) {
    res.status(400).json({ error: "Champs invalides" }); return;
  }
  const body = {
    label: b.label as string,
    account_name: b.account_name as string,
    number: b.number as string,
    instructions: (b.instructions ?? null) as string | null,
    is_active: b.is_active as boolean,
    position: b.position as number | undefined,
  };

  const [current] = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.id, id));
  if (!current) { res.status(404).json({ error: "Mode de paiement introuvable" }); return; }

  if (body.is_active && !body.number.trim()) {
    res.status(400).json({ error: "Le numéro est requis pour un mode actif." }); return;
  }
  if (body.is_active && PHONE_METHODS.has(current.method) && !PHONE_RE.test(body.number.trim())) {
    res.status(400).json({ error: "Numéro Côte d'Ivoire invalide (format: +225 XX XX XX XX XX)." }); return;
  }
  if (!body.is_active) {
    const activeCount = (await db.select({ c: sql<number>`count(*)::int` })
      .from(paymentSettingsTable).where(eq(paymentSettingsTable.isActive, true)))[0]?.c ?? 0;
    if (current.isActive && activeCount <= 1) {
      res.status(400).json({ error: "Vous devez conserver au moins un mode de paiement actif." }); return;
    }
  }

  const updates: Record<string, unknown> = {
    label: body.label.trim(),
    accountName: body.account_name.trim(),
    number: body.number.trim(),
    instructions: body.instructions?.toString().trim() || null,
    isActive: body.is_active,
    updatedAt: new Date(),
    updatedBy: req.auth!.userId,
  };
  if (body.position !== undefined) updates.position = body.position;

  const [updated] = await db.update(paymentSettingsTable).set(updates)
    .where(eq(paymentSettingsTable.id, id)).returning();

  await db.insert(adminLogsTable).values({
    adminId: req.auth!.userId,
    action: "update_payment_setting",
    targetType: "broadcast",
    targetId: id,
    details: {
      method: current.method,
      old_number: current.number,
      new_number: updated!.number,
      old_active: current.isActive,
      new_active: updated!.isActive,
    },
  });

  res.json({ success: true, setting: updated });
});

export default router;
