import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

const VALID_PERIODS = [30, 90, 180, 365];

// GET /api/marche/prix-historique?type_residu=...&periode=30&region=...
router.get("/marche/prix-historique", async (req, res): Promise<void> => {
  const typeResidu = (req.query.type_residu as string | undefined)?.trim();
  const periode = Number(req.query.periode ?? 90);
  const region = (req.query.region as string | undefined)?.trim();
  if (!VALID_PERIODS.includes(periode)) {
    res.status(400).json({ error: "Période invalide (30|90|180|365)" });
    return;
  }

  const filters: any[] = [
    sql`t.status = 'confirmée'`,
    sql`t.created_at > NOW() - (${periode} || ' days')::interval`,
  ];
  if (typeResidu) filters.push(sql`r.type_residu = ${typeResidu}`);
  if (region) filters.push(sql`r.region = ${region}`);
  const where = sql.join(filters, sql` AND `);

  const rows: any[] = (
    await db.execute(sql`
    SELECT
      DATE_TRUNC('week', t.created_at) AS semaine,
      r.type_residu,
      AVG(t.total_fcfa::numeric / NULLIF(t.quantity_kg, 0))::int AS prix_moyen,
      MIN(t.total_fcfa::numeric / NULLIF(t.quantity_kg, 0))::int AS prix_min,
      MAX(t.total_fcfa::numeric / NULLIF(t.quantity_kg, 0))::int AS prix_max,
      SUM(t.quantity_kg)::int AS volume_kg,
      COUNT(*)::int AS nb_transactions
    FROM transactions t
    JOIN residus r ON r.id = t.residu_id
    WHERE ${where}
    GROUP BY semaine, r.type_residu
    ORDER BY semaine ASC
  `)
  ).rows ?? [];

  const halfPoint = Math.floor(rows.length / 2);
  const recent = rows.slice(halfPoint);
  const older = rows.slice(0, halfPoint);
  const avg = (xs: any[]) =>
    xs.length
      ? xs.reduce((s, r) => s + Number(r.prix_moyen ?? 0), 0) / xs.length
      : 0;
  const recentAvg = avg(recent);
  const olderAvg = avg(older);
  const variationPct =
    olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  res.json({
    periode,
    typeResidu: typeResidu ?? null,
    region: region ?? null,
    series: rows.map((r: any) => ({
      semaine: r.semaine,
      typeResidu: r.type_residu,
      prixMoyen: Number(r.prix_moyen ?? 0),
      prixMin: Number(r.prix_min ?? 0),
      prixMax: Number(r.prix_max ?? 0),
      volumeKg: Number(r.volume_kg ?? 0),
      nbTransactions: Number(r.nb_transactions ?? 0),
    })),
    summary: {
      prixMoyenActuel: Math.round(recentAvg),
      variationPct: Math.round(variationPct * 10) / 10,
      volumeTotal: rows.reduce((s, r) => s + Number(r.volume_kg ?? 0), 0),
      nbTransactionsTotal: rows.reduce(
        (s, r) => s + Number(r.nb_transactions ?? 0),
        0,
      ),
    },
  });
});

// GET /api/marche/prix-actuels — avg/min/max from active offers
router.get("/marche/prix-actuels", async (req, res): Promise<void> => {
  const typeResidu = (req.query.type_residu as string | undefined)?.trim();
  const filters: any[] = [sql`status = 'disponible'`];
  if (typeResidu) filters.push(sql`type_residu = ${typeResidu}`);
  const where = sql.join(filters, sql` AND `);

  const rows: any[] = (
    await db.execute(sql`
    SELECT type_residu,
           AVG(price_fcfa::numeric / NULLIF(quantity_kg, 0))::int AS prix_moyen,
           MIN(price_fcfa::numeric / NULLIF(quantity_kg, 0))::int AS prix_min,
           MAX(price_fcfa::numeric / NULLIF(quantity_kg, 0))::int AS prix_max,
           COUNT(*)::int AS nb_offres
      FROM residus
     WHERE ${where}
     GROUP BY type_residu
     ORDER BY type_residu ASC
  `)
  ).rows ?? [];

  res.json({
    prixActuels: rows.map((r: any) => ({
      typeResidu: r.type_residu,
      prixMoyen: Number(r.prix_moyen ?? 0),
      prixMin: Number(r.prix_min ?? 0),
      prixMax: Number(r.prix_max ?? 0),
      nbOffres: Number(r.nb_offres ?? 0),
    })),
  });
});

// GET /api/marche/synthese — per-type summary with 30d vs prev-30d variation
router.get("/marche/synthese", async (req, res): Promise<void> => {
  const recentRows: any[] = (
    await db.execute(sql`
    SELECT r.type_residu,
           AVG(t.total_fcfa::numeric / NULLIF(t.quantity_kg, 0))::int AS prix_moyen,
           SUM(t.quantity_kg)::int AS volume_kg,
           COUNT(*)::int AS nb_transactions
      FROM transactions t
      JOIN residus r ON r.id = t.residu_id
     WHERE t.status = 'confirmée'
       AND t.created_at > NOW() - interval '30 days'
     GROUP BY r.type_residu
  `)
  ).rows ?? [];

  const olderRows: any[] = (
    await db.execute(sql`
    SELECT r.type_residu,
           AVG(t.total_fcfa::numeric / NULLIF(t.quantity_kg, 0))::int AS prix_moyen
      FROM transactions t
      JOIN residus r ON r.id = t.residu_id
     WHERE t.status = 'confirmée'
       AND t.created_at BETWEEN NOW() - interval '60 days' AND NOW() - interval '30 days'
     GROUP BY r.type_residu
  `)
  ).rows ?? [];

  const olderMap: Record<string, number> = {};
  for (const r of olderRows) {
    olderMap[r.type_residu] = Number(r.prix_moyen ?? 0);
  }

  const synthese = recentRows.map((r: any) => {
    const olderPrice = olderMap[r.type_residu] ?? 0;
    const recentPrice = Number(r.prix_moyen ?? 0);
    const variationPct =
      olderPrice > 0
        ? Math.round(((recentPrice - olderPrice) / olderPrice) * 1000) / 10
        : 0;
    return {
      typeResidu: r.type_residu,
      prixMoyen: recentPrice,
      variationPct,
      volumeKg: Number(r.volume_kg ?? 0),
      nbTransactions: Number(r.nb_transactions ?? 0),
    };
  });

  synthese.sort((a, b) => a.typeResidu.localeCompare(b.typeResidu));

  res.json({ synthese });
});

export default router;
