import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import fs from "node:fs";
import {
  db,
  plansTable,
  subscriptionsTable,
  subscriptionInvoicesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";
import {
  getActiveSubscription,
  getPendingSubscription,
  getUserPlan,
  checkContactLimit,
  generateInvoiceReference,
  serializePlan,
  serializeSubscription,
  serializeInvoice,
  getAdminUserIds,
} from "../lib/subscriptions";
import { adminLogsTable } from "@workspace/db";
import { generateInvoicePdf } from "../lib/invoices";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";
import { validateDataUrl } from "../lib/data-url";

const router: IRouter = Router();

// ============ PUBLIC ============

router.get("/plans", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.priceFcfa);
  res.json(plans.map(serializePlan));
});

// ============ AUTHENTICATED ============

router.get("/subscription/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const { plan, subscription } = await getUserPlan(userId);
  const usage = await checkContactLimit(userId);
  const pendingSub = await getPendingSubscription(userId);
  let pendingPlanName: string | null = null;
  if (pendingSub) {
    const [pp] = await db.select().from(plansTable).where(eq(plansTable.id, pendingSub.planId));
    pendingPlanName = pp?.name ?? null;
  }
  res.json({
    plan: serializePlan(plan),
    subscription: subscription ? serializeSubscription(subscription, plan.name) : null,
    pending_subscription: pendingSub ? serializeSubscription(pendingSub, pendingPlanName ?? undefined) : null,
    usage: { contacts_used: usage.used, contacts_limit: usage.limit, month: new Date().toISOString().slice(0, 7) },
  });
});

const VALID_METHODS = ["orange_money", "wave", "mtn_money", "virement"] as const;
type Method = typeof VALID_METHODS[number];

router.post("/subscribe", requireAuth, async (req, res): Promise<void> => {
  if (req.auth!.role !== "transformateur") {
    res.status(403).json({ error: "Réservé aux transformateurs" });
    return;
  }
  const userId = req.auth!.userId;
  const planName = String(req.body?.plan_name ?? "").toLowerCase();
  const method = String(req.body?.payment_method ?? "") as Method;
  const paymentRef = req.body?.payment_reference ? String(req.body.payment_reference).slice(0, 64) : null;
  const proofBase64 = typeof req.body?.payment_proof_base64 === "string" ? req.body.payment_proof_base64 : "";
  const proofFilename = typeof req.body?.payment_proof_filename === "string"
    ? req.body.payment_proof_filename.trim().slice(0, 200)
    : "";

  if (!["pro", "business"].includes(planName)) {
    res.status(400).json({ error: "Plan invalide. Choisissez 'pro' ou 'business'." });
    return;
  }
  if (!VALID_METHODS.includes(method)) {
    res.status(400).json({ error: "Méthode de paiement invalide" });
    return;
  }

  // Payment proof is REQUIRED — server-side enforcement
  if (!proofBase64 || !proofFilename) {
    res.status(400).json({
      error: "PROOF_REQUIRED",
      message: "Veuillez joindre une preuve de paiement",
    });
    return;
  }
  const proofValidation = validateDataUrl(proofBase64, 5 * 1024 * 1024);
  if (!proofValidation.ok) {
    res.status(400).json({
      error: "PROOF_INVALID",
      message: proofValidation.error,
    });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.name, planName));
  if (!plan) { res.status(400).json({ error: "Plan introuvable" }); return; }
  if (!plan.isActive) {
    res.status(400).json({ error: "Ce plan n'est plus disponible à la souscription." });
    return;
  }

  // Reject if user already has a pending request — must wait for admin review or cancel it.
  const existingPending = await getPendingSubscription(userId);
  if (existingPending) {
    res.status(409).json({
      error: "Vous avez déjà une demande d'abonnement en attente de vérification.",
    });
    return;
  }

  // Create a PENDING subscription. Status remains 'en_attente_validation' until admin confirms.
  // No plan features are unlocked. expiresAt is a placeholder — it will be reset to NOW()+30d when admin confirms.
  const now = new Date();
  const placeholderExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ref = generateInvoiceReference(now);

  // Atomic: re-check pending then insert sub + invoice in a single transaction.
  // If another request races us between the earlier check and here, the inner
  // re-check inside the transaction prevents creating duplicate pendings.
  let subscription;
  let invoice;
  try {
    const txResult = await db.transaction(async (tx) => {
      const racing = await tx
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(and(
          eq(subscriptionsTable.userId, userId),
          eq(subscriptionsTable.status, "en_attente_validation"),
        ))
        .limit(1);
      if (racing.length > 0) {
        throw new Error("__DUPLICATE_PENDING__");
      }
      const [s] = await tx.insert(subscriptionsTable).values({
        userId,
        planId: plan.id,
        status: "en_attente_validation",
        startedAt: now,
        expiresAt: placeholderExpires,
        paymentReference: paymentRef,
        paymentMethod: method,
        paymentProofUrl: proofBase64,
        paymentProofFilename: proofFilename,
        paymentProofUploadedAt: now,
      }).returning();
      const [i] = await tx.insert(subscriptionInvoicesTable).values({
        subscriptionId: s.id,
        reference: ref,
        amountFcfa: plan.priceFcfa,
        planName: plan.name,
        periodStart: now.toISOString().slice(0, 10),
        periodEnd: placeholderExpires.toISOString().slice(0, 10),
        status: "en_attente",
        paymentMethod: method,
        paidAt: null,
      }).returning();
      return { s, i };
    });
    subscription = txResult.s;
    invoice = txResult.i;
  } catch (err: any) {
    if (err?.message === "__DUPLICATE_PENDING__") {
      res.status(409).json({
        error: "Vous avez déjà une demande d'abonnement en attente de vérification.",
      });
      return;
    }
    throw err;
  }

  // Notify admins of pending payment to verify
  try {
    const [requester] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await createNotification({
        userId: adminId,
        type: "broadcast",
        title: "Nouveau paiement à vérifier",
        body: `${requester?.name ?? "Un transformateur"} demande l'activation du plan ${plan.name === "pro" ? "Pro" : "Business"}.`,
        link: "/admin/abonnements",
      });
    }
  } catch (err) {
    logger.error({ err }, "admin pending-subscription notification failed");
  }

  res.status(201).json({
    subscription: serializeSubscription(subscription, plan.name),
    invoice: serializeInvoice(invoice),
    plan: serializePlan(plan),
    pending: true,
  });
});

router.post("/subscription/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const sub = await getActiveSubscription(userId);
  if (!sub) { res.status(404).json({ error: "Aucun abonnement actif" }); return; }
  // Soft cancel — keep access until expiry
  const [updated] = await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(subscriptionsTable.id, sub.id))
    .returning();
  await createNotification({
    userId, type: "broadcast",
    title: "Abonnement annulé",
    body: `Vous gardez l'accès Pro jusqu'au ${updated.expiresAt.toLocaleDateString("fr-FR")}.`,
    link: "/abonnement",
  });
  res.json({ subscription: serializeSubscription(updated) });
});

router.get("/invoices", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const rows = await db
    .select({ inv: subscriptionInvoicesTable, sub: subscriptionsTable })
    .from(subscriptionInvoicesTable)
    .innerJoin(subscriptionsTable, eq(subscriptionInvoicesTable.subscriptionId, subscriptionsTable.id))
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionInvoicesTable.createdAt));
  res.json(rows.map(r => serializeInvoice(r.inv)));
});

router.get("/invoices/:id/download", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const userId = req.auth!.userId;
  const [row] = await db
    .select({ inv: subscriptionInvoicesTable, sub: subscriptionsTable })
    .from(subscriptionInvoicesTable)
    .innerJoin(subscriptionsTable, eq(subscriptionInvoicesTable.subscriptionId, subscriptionsTable.id))
    .where(eq(subscriptionInvoicesTable.id, id));
  if (!row) { res.status(404).json({ error: "Facture introuvable" }); return; }
  // Admins can also download
  const isAdminUser = (await getAdminUserIds()).includes(userId);
  if (row.sub.userId !== userId && !isAdminUser) { res.status(403).json({ error: "Accès refusé" }); return; }

  let pdfPath = row.inv.pdfUrl;
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    pdfPath = await generateInvoicePdf(row.inv.id);
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${row.inv.reference}.pdf"`);
  fs.createReadStream(pdfPath).pipe(res);
});

// ============ ADMIN ============

// ─── ADMIN: Plan management ────────────────────────────────────────────────

router.get(
  "/admin/plans",
  requireAuth, requireAdmin, requirePermission("plans", "view"),
  async (_req, res): Promise<void> => {
    const plans = await db
      .select({
        id: plansTable.id,
        name: plansTable.name,
        label: plansTable.label,
        priceFcfa: plansTable.priceFcfa,
        contactsPerMonth: plansTable.contactsPerMonth,
        features: plansTable.features,
        description: plansTable.description,
        isPopular: plansTable.isPopular,
        isActive: plansTable.isActive,
        updatedAt: plansTable.updatedAt,
        updatedBy: plansTable.updatedBy,
        priceHistory: plansTable.priceHistory,
        updatedByName: usersTable.name,
        activeSubscribers: sql<number>`(
          SELECT COUNT(*)::int FROM ${subscriptionsTable}
          WHERE ${subscriptionsTable.planId} = ${plansTable.id}
            AND ${subscriptionsTable.status} = 'active'
            AND ${subscriptionsTable.expiresAt} > NOW()
        )`,
      })
      .from(plansTable)
      .leftJoin(usersTable, eq(plansTable.updatedBy, usersTable.id))
      .orderBy(plansTable.priceFcfa);

    res.json(plans.map(p => ({
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
      updated_by_name: p.updatedByName ?? null,
      price_history: p.priceHistory ?? [],
      active_subscribers: Number(p.activeSubscribers ?? 0),
    })));
  },
);

router.get(
  "/admin/plans/:id/history",
  requireAuth, requireAdmin, requirePermission("plans", "view"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
    const [plan] = await db
      .select({ name: plansTable.name, label: plansTable.label, priceHistory: plansTable.priceHistory })
      .from(plansTable)
      .where(eq(plansTable.id, id));
    if (!plan) { res.status(404).json({ error: "Plan introuvable" }); return; }
    const history = [...(plan.priceHistory ?? [])].sort(
      (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
    );
    res.json({ plan_name: plan.name, plan_label: plan.label, history });
  },
);

router.put(
  "/admin/plans/:id",
  requireAuth, requireAdmin, requirePermission("plans", "edit"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

    const body = req.body ?? {};
    const priceFcfa = Number(body.price_fcfa);
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
    const contactsPerMonth = Number(body.contacts_per_month);
    const isActive = body.is_active === true || body.is_active === "true";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    // `features` is intentionally not editable from this endpoint to prevent malformed payloads.

    if (!Number.isFinite(priceFcfa) || priceFcfa < 0) {
      res.status(400).json({ error: "Le prix doit être un nombre positif ou nul." });
      return;
    }
    if (!Number.isFinite(contactsPerMonth) || contactsPerMonth < 0) {
      res.status(400).json({ error: "Le nombre de contacts doit être positif ou nul." });
      return;
    }
    if (!label) { res.status(400).json({ error: "Le nom du plan est requis." }); return; }
    if (reason.length < 10) {
      res.status(400).json({ error: "Le motif doit contenir au moins 10 caractères." });
      return;
    }

    const adminId = req.auth!.userId;
    const [adminUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, adminId));

    let updated: typeof plansTable.$inferSelect | undefined;
    let oldPrice = 0;
    let existingName = "";
    try {
      await db.transaction(async (tx) => {
        // Lock row to prevent concurrent price_history lost updates
        const locked = await tx.execute(
          sql`SELECT * FROM ${plansTable} WHERE ${plansTable.id} = ${id} FOR UPDATE`,
        );
        const row = (locked as any).rows?.[0] ?? (locked as any)[0];
        if (!row) { throw new Error("PLAN_NOT_FOUND"); }
        oldPrice = Number(row.price_fcfa);
        existingName = String(row.name);
        const currentHistory = Array.isArray(row.price_history) ? row.price_history : [];

        const newHistoryEntry = {
          old_price: oldPrice,
          new_price: priceFcfa,
          changed_by: adminId,
          changed_by_name: adminUser?.name ?? null,
          changed_at: new Date().toISOString(),
          reason,
        };
        const updatedHistory = oldPrice !== priceFcfa
          ? [...currentHistory, newHistoryEntry]
          : currentHistory;

        const [u] = await tx
          .update(plansTable)
          .set({
            label,
            description,
            priceFcfa,
            contactsPerMonth,
            isActive,
            ...(features ? { features } : {}),
            priceHistory: updatedHistory,
            updatedAt: new Date(),
            updatedBy: adminId,
          })
          .where(eq(plansTable.id, id))
          .returning();
        updated = u;

        await tx.insert(adminLogsTable).values({
          adminId,
          action: "update_plan",
          targetType: "plan",
          targetId: id,
          details: {
            plan_name: existingName,
            old_price: oldPrice,
            new_price: priceFcfa,
            price_changed: oldPrice !== priceFcfa,
            is_active: isActive,
            reason,
          },
        });
      });
    } catch (err: any) {
      if (err?.message === "PLAN_NOT_FOUND") {
        res.status(404).json({ error: "Plan introuvable" });
        return;
      }
      throw err;
    }
    if (!updated) { res.status(500).json({ error: "Échec de la mise à jour" }); return; }

    logger.info({ planId: id, oldPrice, newPrice: priceFcfa, adminId }, "Plan updated");

    res.json({
      success: true,
      plan: {
        id: updated!.id,
        name: updated!.name,
        label: updated!.label,
        price_fcfa: updated!.priceFcfa,
        contacts_per_month: updated!.contactsPerMonth,
        features: updated!.features,
        description: updated!.description,
        is_popular: updated!.isPopular,
        is_active: updated!.isActive,
        updated_at: updated!.updatedAt.toISOString(),
        updated_by: updated!.updatedBy ?? null,
        updated_by_name: adminUser?.name ?? null,
        price_history: updated!.priceHistory ?? [],
      },
    });
  },
);

router.get("/admin/subscriptions", requireAuth, requireAdmin, requirePermission("subscriptions", "view"), async (req, res): Promise<void> => {
  const status = req.query.status ? String(req.query.status) : null;
  const planName = req.query.plan ? String(req.query.plan) : null;
  const conditions = [];
  if (status) conditions.push(eq(subscriptionsTable.status, status));
  if (planName) conditions.push(eq(plansTable.name, planName));

  const rows = await db
    .select({
      id: subscriptionsTable.id,
      userId: subscriptionsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userRole: usersTable.role,
      planName: plansTable.name,
      planPrice: plansTable.priceFcfa,
      status: subscriptionsTable.status,
      startedAt: subscriptionsTable.startedAt,
      expiresAt: subscriptionsTable.expiresAt,
      paymentMethod: subscriptionsTable.paymentMethod,
      paymentReference: subscriptionsTable.paymentReference,
      paymentProofFilename: subscriptionsTable.paymentProofFilename,
      paymentProofUploadedAt: subscriptionsTable.paymentProofUploadedAt,
      hasProof: sql<boolean>`(${subscriptionsTable.paymentProofUrl} IS NOT NULL)`,
      createdAt: subscriptionsTable.createdAt,
    })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .innerJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(subscriptionsTable.createdAt));

  // Stats
  const [stats] = await db
    .select({
      totalActive: sql<number>`count(*) FILTER (WHERE ${subscriptionsTable.status} = 'active' AND ${subscriptionsTable.expiresAt} > NOW())::int`,
      totalPending: sql<number>`count(*) FILTER (WHERE ${subscriptionsTable.status} = 'en_attente_validation')::int`,
      totalRevenue: sql<number>`COALESCE(SUM(${subscriptionInvoicesTable.amountFcfa}) FILTER (WHERE ${subscriptionInvoicesTable.status} = 'payée'), 0)::int`,
    })
    .from(subscriptionsTable)
    .leftJoin(subscriptionInvoicesTable, eq(subscriptionInvoicesTable.subscriptionId, subscriptionsTable.id));

  res.json({
    subscriptions: rows.map(r => ({
      id: r.id,
      user_id: r.userId,
      user_name: r.userName,
      user_email: r.userEmail,
      user_role: r.userRole,
      plan_name: r.planName,
      plan_price_fcfa: r.planPrice,
      status: r.status,
      started_at: r.startedAt.toISOString(),
      expires_at: r.expiresAt.toISOString(),
      payment_method: r.paymentMethod,
      payment_reference: r.paymentReference,
      payment_proof_filename: r.paymentProofFilename,
      payment_proof_uploaded_at: r.paymentProofUploadedAt?.toISOString() ?? null,
      has_payment_proof: !!r.hasProof,
      created_at: r.createdAt.toISOString(),
    })),
    stats: {
      total_active: Number(stats?.totalActive ?? 0),
      total_pending: Number(stats?.totalPending ?? 0),
      total_revenue_fcfa: Number(stats?.totalRevenue ?? 0),
    },
  });
});

// ─── ADMIN: View payment proof for a subscription ──────────────────────────
router.get(
  "/admin/subscriptions/:id/proof",
  requireAuth,
  requireAdmin,
  requirePermission("subscriptions", "view"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

    const [sub] = await db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        proofUrl: subscriptionsTable.paymentProofUrl,
        proofFilename: subscriptionsTable.paymentProofFilename,
        proofUploadedAt: subscriptionsTable.paymentProofUploadedAt,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, id));

    if (!sub) { res.status(404).json({ error: "Abonnement introuvable" }); return; }
    if (!sub.proofUrl) {
      res.status(404).json({ error: "Aucune preuve de paiement disponible" });
      return;
    }

    // Log the proof access for audit
    try {
      await db.insert(adminLogsTable).values({
        adminId: req.auth!.userId,
        action: "subscription_proof_view",
        targetType: "user",
        targetId: sub.userId,
        details: { subscription_id: sub.id, filename: sub.proofFilename },
      });
    } catch (err) {
      logger.error({ err }, "admin proof-view log failed");
    }

    res.json({
      payment_proof_url: sub.proofUrl,
      payment_proof_filename: sub.proofFilename,
      payment_proof_uploaded_at: sub.proofUploadedAt?.toISOString() ?? null,
    });
  },
);

// ─── ADMIN: Confirm a pending subscription ─────────────────────────────────
router.post(
  "/admin/subscriptions/:id/confirm",
  requireAuth,
  requireAdmin,
  requirePermission("subscriptions", "manage"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Abonnement introuvable" }); return; }
    if (sub.status !== "en_attente_validation") {
      res.status(400).json({ error: "Cet abonnement n'est pas en attente de validation." });
      return;
    }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, sub.planId));
    if (!plan) { res.status(500).json({ error: "Plan introuvable" }); return; }

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Atomic conditional activation — only succeeds if status is still pending.
    // Prevents race when two admins click confirm simultaneously.
    const [activated] = await db.update(subscriptionsTable)
      .set({
        status: "active",
        startedAt: now,
        expiresAt: expires,
      })
      .where(and(
        eq(subscriptionsTable.id, sub.id),
        eq(subscriptionsTable.status, "en_attente_validation"),
      ))
      .returning();

    if (!activated) {
      res.status(409).json({ error: "Cet abonnement a déjà été traité par un autre administrateur." });
      return;
    }

    // Cancel any other ACTIVE sub for this user (different plan being upgraded/changed)
    await db.update(subscriptionsTable)
      .set({ status: "cancelled", cancelledAt: now })
      .where(and(
        eq(subscriptionsTable.userId, sub.userId),
        eq(subscriptionsTable.status, "active"),
        sql`${subscriptionsTable.id} <> ${sub.id}`,
      ));

    // Mark invoice as payée
    const [invoice] = await db.update(subscriptionInvoicesTable)
      .set({
        status: "payée",
        paidAt: now,
        periodStart: now.toISOString().slice(0, 10),
        periodEnd: expires.toISOString().slice(0, 10),
      })
      .where(eq(subscriptionInvoicesTable.subscriptionId, sub.id))
      .returning();

    if (invoice) {
      try { await generateInvoicePdf(invoice.id); } catch (err) { logger.error({ err }, "invoice pdf generation failed"); }
    }

    const planLabel = plan.name === "pro" ? "Pro" : "Business";
    await createNotification({
      userId: sub.userId,
      type: "broadcast",
      title: `🎉 Abonnement ${planLabel} activé !`,
      body: "Votre paiement a été vérifié. Toutes vos fonctionnalités sont maintenant débloquées.",
      link: "/abonnement",
    });

    await db.insert(adminLogsTable).values({
      adminId: req.auth!.userId,
      action: "subscription_confirm",
      targetType: "user",
      targetId: sub.userId,
      details: {
        subscription_id: sub.id,
        plan: plan.name,
        amount_fcfa: plan.priceFcfa,
        payment_method: sub.paymentMethod,
        payment_reference: sub.paymentReference,
      },
    });

    res.json({
      subscription: serializeSubscription(activated, plan.name),
      invoice: invoice ? serializeInvoice(invoice) : null,
    });
  },
);

// ─── ADMIN: Reject a pending subscription ──────────────────────────────────
router.post(
  "/admin/subscriptions/:id/reject",
  requireAuth,
  requireAdmin,
  requirePermission("subscriptions", "manage"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
    const reason = String(req.body?.reason ?? "").trim().slice(0, 500);
    if (!reason) { res.status(400).json({ error: "Motif requis" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Abonnement introuvable" }); return; }
    if (sub.status !== "en_attente_validation") {
      res.status(400).json({ error: "Cet abonnement n'est pas en attente de validation." });
      return;
    }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, sub.planId));

    // Atomic conditional rejection — prevents race with concurrent confirm.
    const [rejected] = await db.update(subscriptionsTable)
      .set({ status: "rejeté", cancelledAt: new Date() })
      .where(and(
        eq(subscriptionsTable.id, sub.id),
        eq(subscriptionsTable.status, "en_attente_validation"),
      ))
      .returning();
    if (!rejected) {
      res.status(409).json({ error: "Cet abonnement a déjà été traité par un autre administrateur." });
      return;
    }

    // Cancel related pending invoice
    await db.update(subscriptionInvoicesTable)
      .set({ status: "annulée" })
      .where(and(
        eq(subscriptionInvoicesTable.subscriptionId, sub.id),
        eq(subscriptionInvoicesTable.status, "en_attente"),
      ));

    await createNotification({
      userId: sub.userId,
      type: "broadcast",
      title: "❌ Paiement non confirmé",
      body: `Motif : ${reason}. Contactez-nous si vous pensez que c'est une erreur.`,
      link: "/abonnement",
    });

    await db.insert(adminLogsTable).values({
      adminId: req.auth!.userId,
      action: "subscription_reject",
      targetType: "user",
      targetId: sub.userId,
      details: {
        subscription_id: sub.id,
        plan: plan?.name ?? null,
        reason,
        payment_method: sub.paymentMethod,
        payment_reference: sub.paymentReference,
      },
    });

    res.json({ subscription: serializeSubscription(rejected, plan?.name) });
  },
);

export default router;
