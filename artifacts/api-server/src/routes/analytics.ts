import { Router, type IRouter } from "express";
import { db, pageViewsTable, offerViewsTable, conversionEventsTable, usersTable, residusTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { sql, gte, and, eq, desc, lte } from "drizzle-orm";

const router: IRouter = Router();

router.use("/admin/analytics", requireAuth, requireAdmin);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function periodStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekStart(): Date {
  return periodStart(7);
}

function monthStart(): Date {
  return periodStart(30);
}

async function countUniqueVisitors(from: Date, to?: Date): Promise<number> {
  const conditions = to
    ? and(gte(pageViewsTable.createdAt, from), lte(pageViewsTable.createdAt, to))
    : gte(pageViewsTable.createdAt, from);
  const [row] = await db
    .select({ c: sql<number>`count(distinct ${pageViewsTable.sessionId})::int` })
    .from(pageViewsTable)
    .where(conditions);
  return row?.c ?? 0;
}

async function countPageViews(from: Date, to?: Date): Promise<number> {
  const conditions = to
    ? and(gte(pageViewsTable.createdAt, from), lte(pageViewsTable.createdAt, to))
    : gte(pageViewsTable.createdAt, from);
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(pageViewsTable)
    .where(conditions);
  return row?.c ?? 0;
}

async function countNewUsers(from: Date, to?: Date): Promise<number> {
  const conditions = to
    ? and(gte(usersTable.createdAt, from), lte(usersTable.createdAt, to))
    : gte(usersTable.createdAt, from);
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(conditions);
  return row?.c ?? 0;
}

async function countOfferViews(from: Date, to?: Date): Promise<number> {
  const conditions = to
    ? and(gte(offerViewsTable.createdAt, from), lte(offerViewsTable.createdAt, to))
    : gte(offerViewsTable.createdAt, from);
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(offerViewsTable)
    .where(conditions);
  return row?.c ?? 0;
}

// ─── OVERVIEW ───────────────────────────────────────────────────────────────

router.get("/admin/analytics/overview", async (req, res): Promise<void> => {
  const now = new Date();
  const today = todayStart();
  const week = weekStart();
  const month = monthStart();
  const prevMonthStart = periodStart(60);

  const [
    visitorsToday, visitorsWeek, visitorsMonth, visitorsPrevMonth,
    pvToday, pvWeek, pvMonth,
    newUsersToday, newUsersWeek, newUsersMonth, newUsersPrevMonth,
    offerViewsToday, offerViewsWeek, offerViewsMonth,
  ] = await Promise.all([
    countUniqueVisitors(today),
    countUniqueVisitors(week),
    countUniqueVisitors(month),
    countUniqueVisitors(prevMonthStart, month),
    countPageViews(today),
    countPageViews(week),
    countPageViews(month),
    countNewUsers(today),
    countNewUsers(week),
    countNewUsers(month),
    countNewUsers(prevMonthStart, month),
    countOfferViews(today),
    countOfferViews(week),
    countOfferViews(month),
  ]);

  // Top pages
  const topPages = await db
    .select({
      path: pageViewsTable.path,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${pageViewsTable.sessionId})::int`,
    })
    .from(pageViewsTable)
    .where(gte(pageViewsTable.createdAt, month))
    .groupBy(pageViewsTable.path)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  // Top offers
  const topOffers = await db
    .select({
      typeResidu: residusTable.typeResidu,
      views: sql<number>`count(${offerViewsTable.id})::int`,
    })
    .from(offerViewsTable)
    .innerJoin(residusTable, eq(offerViewsTable.offreId, residusTable.id))
    .where(gte(offerViewsTable.createdAt, month))
    .groupBy(residusTable.typeResidu)
    .orderBy(desc(sql`count(${offerViewsTable.id})`))
    .limit(8);

  // Devices
  const deviceRows = await db
    .select({
      deviceType: pageViewsTable.deviceType,
      count: sql<number>`count(*)::int`,
    })
    .from(pageViewsTable)
    .where(gte(pageViewsTable.createdAt, month))
    .groupBy(pageViewsTable.deviceType);

  const totalDevices = deviceRows.reduce((s, r) => s + r.count, 0) || 1;
  const devices: Record<string, number> = { mobile: 0, tablet: 0, desktop: 0 };
  for (const r of deviceRows) {
    devices[r.deviceType] = Math.round((r.count / totalDevices) * 100);
  }

  // By hour
  const byHour = await db
    .select({
      hour: sql<number>`extract(hour from ${pageViewsTable.createdAt})::int`,
      visitors: sql<number>`count(distinct ${pageViewsTable.sessionId})::int`,
    })
    .from(pageViewsTable)
    .where(gte(pageViewsTable.createdAt, month))
    .groupBy(sql`extract(hour from ${pageViewsTable.createdAt})`)
    .orderBy(sql`extract(hour from ${pageViewsTable.createdAt})`);

  // Regions
  const byRegion = await db
    .select({
      region: usersTable.region,
      users: sql<number>`count(distinct ${usersTable.id})::int`,
    })
    .from(usersTable)
    .where(gte(usersTable.createdAt, month))
    .groupBy(usersTable.region)
    .orderBy(desc(sql`count(distinct ${usersTable.id})`))
    .limit(10);

  // Conversion funnel
  const [totalVisitors, registered, firstOffers, firstContacts, firstTransactions, subscriptions] = await Promise.all([
    countUniqueVisitors(month),
    db.select({ c: sql<number>`count(*)::int` }).from(conversionEventsTable)
      .where(and(eq(conversionEventsTable.eventType, "register"), gte(conversionEventsTable.createdAt, month)))
      .then(([r]) => r?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(conversionEventsTable)
      .where(and(eq(conversionEventsTable.eventType, "first_offer"), gte(conversionEventsTable.createdAt, month)))
      .then(([r]) => r?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(conversionEventsTable)
      .where(and(eq(conversionEventsTable.eventType, "first_contact"), gte(conversionEventsTable.createdAt, month)))
      .then(([r]) => r?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(conversionEventsTable)
      .where(and(eq(conversionEventsTable.eventType, "first_transaction"), gte(conversionEventsTable.createdAt, month)))
      .then(([r]) => r?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(conversionEventsTable)
      .where(and(eq(conversionEventsTable.eventType, "subscription"), gte(conversionEventsTable.createdAt, month)))
      .then(([r]) => r?.c ?? 0),
  ]);

  const pct = (n: number, base: number) => base === 0 ? 0 : Math.round((n / base) * 100);
  const change = (curr: number, prev: number) =>
    prev === 0 ? null : `${curr >= prev ? "+" : ""}${Math.round(((curr - prev) / prev) * 100)}%`;

  res.json({
    today: { visitors: visitorsToday, page_views: pvToday, new_users: newUsersToday, offers_viewed: offerViewsToday },
    week: { visitors: visitorsWeek, page_views: pvWeek, new_users: newUsersWeek, offers_viewed: offerViewsWeek },
    month: { visitors: visitorsMonth, page_views: pvMonth, new_users: newUsersMonth, offers_viewed: offerViewsMonth },
    vs_last_period: {
      visitors_change: change(visitorsMonth, visitorsPrevMonth),
      users_change: change(newUsersMonth, newUsersPrevMonth),
    },
    top_pages: topPages,
    top_offers: topOffers,
    devices,
    by_hour: byHour,
    conversion_funnel: {
      visitors: totalVisitors,
      registered,
      first_offer: firstOffers,
      first_contact: firstContacts,
      first_transaction: firstTransactions,
      subscription: subscriptions,
      pct_registered: pct(registered, totalVisitors),
      pct_first_offer: pct(firstOffers, registered),
      pct_first_contact: pct(firstContacts, registered),
      pct_first_transaction: pct(firstTransactions, firstContacts),
      pct_subscription: pct(subscriptions, firstTransactions),
    },
    by_region: byRegion.filter((r) => r.region),
  });
});

// ─── TRAFFIC TIME SERIES ────────────────────────────────────────────────────

router.get("/admin/analytics/traffic", async (req, res): Promise<void> => {
  const days = Number(req.query.period) || 30;
  const from = periodStart(days);

  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${pageViewsTable.createdAt})::date::text`,
      visitors: sql<number>`count(distinct ${pageViewsTable.sessionId})::int`,
      page_views: sql<number>`count(*)::int`,
    })
    .from(pageViewsTable)
    .where(gte(pageViewsTable.createdAt, from))
    .groupBy(sql`date_trunc('day', ${pageViewsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${pageViewsTable.createdAt})`);

  const newUserRows = await db
    .select({
      date: sql<string>`date_trunc('day', ${usersTable.createdAt})::date::text`,
      new_users: sql<number>`count(*)::int`,
    })
    .from(usersTable)
    .where(gte(usersTable.createdAt, from))
    .groupBy(sql`date_trunc('day', ${usersTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usersTable.createdAt})`);

  const newUserMap = new Map(newUserRows.map((r) => [r.date, r.new_users]));

  const data = rows.map((r) => ({
    date: r.date,
    visitors: r.visitors,
    page_views: r.page_views,
    new_users: newUserMap.get(r.date) ?? 0,
  }));

  res.json(data);
});

// ─── REAL-TIME ───────────────────────────────────────────────────────────────

router.get("/admin/analytics/realtime", async (req, res): Promise<void> => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [activeRow] = await db
    .select({ count: sql<number>`count(distinct ${pageViewsTable.sessionId})::int` })
    .from(pageViewsTable)
    .where(gte(pageViewsTable.createdAt, fiveMinAgo));

  const topPages = await db
    .select({
      path: pageViewsTable.path,
      count: sql<number>`count(*)::int`,
    })
    .from(pageViewsTable)
    .where(gte(pageViewsTable.createdAt, fiveMinAgo))
    .groupBy(pageViewsTable.path)
    .orderBy(desc(sql`count(*)`))
    .limit(3);

  res.json({
    active_visitors: activeRow?.count ?? 0,
    top_pages: topPages,
    refreshed_at: new Date().toISOString(),
  });
});

// ─── CONVERSIONS ─────────────────────────────────────────────────────────────

router.get("/admin/analytics/conversions", async (req, res): Promise<void> => {
  const days = Number(req.query.period) || 30;
  const from = periodStart(days);

  const rows = await db
    .select({
      eventType: conversionEventsTable.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(conversionEventsTable)
    .where(gte(conversionEventsTable.createdAt, from))
    .groupBy(conversionEventsTable.eventType);

  res.json(rows);
});

export default router;
