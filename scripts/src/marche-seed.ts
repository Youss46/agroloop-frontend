import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SEED_DATA = [
  {
    type: "Cabosses de cacao",
    priceBase: 95,
    priceRange: [85, 110],
    volumeBase: 1100,
    volumeRange: [200, 2000],
    trendPct: 8,
    regions: ["Abengourou", "San Pedro", "Soubré"],
  },
  {
    type: "Coques d'anacarde",
    priceBase: 58,
    priceRange: [45, 70],
    volumeBase: 1750,
    volumeRange: [500, 3000],
    trendPct: 0,
    regions: ["Bouaké", "Korhogo", "Mankono"],
  },
  {
    type: "Tiges de plantain",
    priceBase: 22,
    priceRange: [15, 30],
    volumeBase: 450,
    volumeRange: [100, 800],
    trendPct: -5,
    regions: ["Abidjan", "San Pedro", "Yamoussoukro"],
  },
  {
    type: "Coques de palmiste",
    priceBase: 45,
    priceRange: [35, 55],
    volumeBase: 900,
    volumeRange: [300, 1500],
    trendPct: 2,
    regions: ["San Pedro", "Soubré", "Sassandra"],
  },
  {
    type: "Rafles de palmier",
    priceBase: 30,
    priceRange: [20, 40],
    volumeBase: 600,
    volumeRange: [200, 1000],
    trendPct: 12,
    regions: ["San Pedro", "Gagnoa"],
  },
  {
    type: "Feuilles de manioc",
    priceBase: 17,
    priceRange: [10, 25],
    volumeBase: 225,
    volumeRange: [50, 400],
    trendPct: 0,
    regions: ["Yamoussoukro", "Bouaké", "Abidjan"],
  },
  {
    type: "Bois d'hévéa",
    priceBase: 75,
    priceRange: [60, 90],
    volumeBase: 3000,
    volumeRange: [1000, 5000],
    trendPct: 15,
    regions: ["Gagnoa", "Divo", "San Pedro"],
  },
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

async function seedMarche() {
  const client = await pool.connect();

  try {
    const prodRow = await client.query(
      `SELECT id FROM users WHERE email = 'demo.producteur@agroloop.ci' LIMIT 1`,
    );
    const transRow = await client.query(
      `SELECT id FROM users WHERE email = 'demo.transformateur@agroloop.ci' LIMIT 1`,
    );

    if (prodRow.rows.length === 0 || transRow.rows.length === 0) {
      console.error(
        "Comptes démo introuvables. Exécutez d'abord demo-seed.ts.",
      );
      process.exit(1);
    }

    const sellerId: number = prodRow.rows[0].id;
    const buyerId: number = transRow.rows[0].id;

    console.log(`Producteur ID=${sellerId}  Transformateur ID=${buyerId}`);

    let totalResidus = 0;
    let totalTransactions = 0;

    for (const entry of SEED_DATA) {
      for (const region of entry.regions) {
        const totalVolume = entry.volumeBase * 12;
        const avgPrice = entry.priceBase;

        const residuRes = await client.query(
          `INSERT INTO residus
             (user_id, type_residu, quantity_kg, price_fcfa, region,
              status, disponibilite, livraison_possible, created_at)
           VALUES ($1, $2, $3, $4, $5, 'vendu', 'immediate', false,
                   NOW() - interval '91 days')
           RETURNING id`,
          [sellerId, entry.type, totalVolume, avgPrice * totalVolume, region],
        );

        const residuId: number = residuRes.rows[0].id;
        totalResidus++;

        for (let week = 0; week < 12; week++) {
          const weeksAgo = 12 - week;
          const trendFactor =
            1 + (entry.trendPct / 100) * (week / Math.max(1, 11));

          const basePrice = entry.priceBase * trendFactor;
          const noise = 1 + randBetween(-0.07, 0.07);
          const unitPrice = Math.round(
            clamp(basePrice * noise, entry.priceRange[0], entry.priceRange[1]),
          );

          const volNoise = 1 + randBetween(-0.25, 0.25);
          const volume = Math.max(
            50,
            Math.round(
              clamp(
                entry.volumeBase * volNoise,
                entry.volumeRange[0],
                entry.volumeRange[1],
              ),
            ),
          );

          const total = unitPrice * volume;
          const dayOffset = Math.floor(randBetween(0, 7));

          await client.query(
            `INSERT INTO transactions
               (residu_id, buyer_id, seller_id, quantity_kg, total_fcfa,
                status, source, created_at)
             VALUES ($1, $2, $3, $4, $5, 'confirmée', 'directe',
                     NOW() - ($6 || ' weeks')::interval - ($7 || ' days')::interval)`,
            [residuId, buyerId, sellerId, volume, total, weeksAgo, dayOffset],
          );

          totalTransactions++;
        }
      }
    }

    console.log(
      `✅ ${totalResidus} résidus et ${totalTransactions} transactions insérés.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

seedMarche().catch((err) => {
  console.error("Échec :", err);
  process.exit(1);
});
