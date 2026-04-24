import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const hash = (password: string) => bcrypt.hashSync(password, 10);

async function seed() {
  console.log("Seeding database...");

  const producteurs = await db
    .insert(schema.usersTable)
    .values([
      {
        name: "Bernard Konaté",
        email: "bernard@example.com",
        passwordHash: hash("password123"),
        role: "producteur",
        phone: "+225 0701234567",
        region: "Abengourou",
      },
      {
        name: "Marie Coulibaly",
        email: "marie@example.com",
        passwordHash: hash("password123"),
        role: "producteur",
        phone: "+225 0712345678",
        region: "San Pedro",
      },
      {
        name: "Karim Diallo",
        email: "karim@example.com",
        passwordHash: hash("password123"),
        role: "producteur",
        phone: "+225 0723456789",
        region: "Bouaké",
      },
    ])
    .onConflictDoNothing()
    .returning();

  const transformateurs = await db
    .insert(schema.usersTable)
    .values([
      {
        name: "Koné Industrie",
        email: "kone@example.com",
        passwordHash: hash("password123"),
        role: "transformateur",
        phone: "+225 0734567890",
        region: "Abidjan",
      },
      {
        name: "EcoAgro CI",
        email: "ecoagro@example.com",
        passwordHash: hash("password123"),
        role: "transformateur",
        phone: "+225 0745678901",
        region: "Yamoussoukro",
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`Inserted ${producteurs.length} producteurs, ${transformateurs.length} transformateurs`);

  // Get all producteur IDs from DB
  const allUsers = await db.select().from(schema.usersTable);
  const bernardId = allUsers.find(u => u.email === "bernard@example.com")?.id;
  const marieId = allUsers.find(u => u.email === "marie@example.com")?.id;
  const karimId = allUsers.find(u => u.email === "karim@example.com")?.id;

  if (!bernardId || !marieId || !karimId) {
    console.log("Users already exist, skipping residus seed");
    await pool.end();
    return;
  }

  const offers = await db
    .insert(schema.residusTable)
    .values([
      {
        userId: bernardId,
        typeResidu: "Coques de cacao",
        quantityKg: 5000,
        priceFcfa: 50000,
        latitude: 6.7294,
        longitude: -3.4964,
        region: "Abengourou",
        description: "Coques de cacao séchées, prêtes pour la valorisation énergétique ou le compost.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: false,
      },
      {
        userId: bernardId,
        typeResidu: "Pulpe de café",
        quantityKg: 2000,
        priceFcfa: 30000,
        latitude: 6.7300,
        longitude: -3.4950,
        region: "Abengourou",
        description: "Pulpe de café fraîche issue de la récolte de la saison.",
        status: "disponible",
        disponibilite: "planifiee",
        livraisonPossible: true,
      },
      {
        userId: marieId,
        typeResidu: "Rafles de palmier",
        quantityKg: 8000,
        priceFcfa: 40000,
        latitude: 4.7485,
        longitude: -6.6363,
        region: "San Pedro",
        description: "Rafles de régimes de palmier à huile, excellentes pour la production de biochar.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: true,
      },
      {
        userId: marieId,
        typeResidu: "Tiges de bananier",
        quantityKg: 3000,
        priceFcfa: 15000,
        latitude: 4.7500,
        longitude: -6.6400,
        region: "San Pedro",
        description: "Tiges de bananier après récolte, riches en fibres.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: false,
      },
      {
        userId: karimId,
        typeResidu: "Son de maïs",
        quantityKg: 10000,
        priceFcfa: 80000,
        latitude: 7.6899,
        longitude: -5.0300,
        region: "Bouaké",
        description: "Son de maïs de haute qualité, idéal pour l'alimentation animale ou la transformation.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: true,
      },
      {
        userId: karimId,
        typeResidu: "Paille de riz",
        quantityKg: 15000,
        priceFcfa: 60000,
        latitude: 7.6800,
        longitude: -5.0400,
        region: "Bouaké",
        description: "Grande quantité de paille de riz disponible après la récolte.",
        status: "disponible",
        disponibilite: "planifiee",
        livraisonPossible: false,
      },
      {
        userId: bernardId,
        typeResidu: "Balle de riz",
        quantityKg: 4000,
        priceFcfa: 20000,
        latitude: 5.3600,
        longitude: -4.0083,
        region: "Abidjan",
        description: "Balle de riz pour valorisation énergétique.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: true,
      },
      {
        userId: marieId,
        typeResidu: "Marc de canne à sucre",
        quantityKg: 20000,
        priceFcfa: 100000,
        latitude: 6.8276,
        longitude: -5.2893,
        region: "Korhogo",
        description: "Bagasse de canne à sucre en grande quantité, excellente pour la production de bioénergie.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: false,
      },
      {
        userId: karimId,
        typeResidu: "Feuilles de manioc",
        quantityKg: 1500,
        priceFcfa: 12000,
        latitude: 6.8909,
        longitude: -5.2764,
        region: "Yamoussoukro",
        description: "Feuilles de manioc séchées, riches en protéines pour l'alimentation animale.",
        status: "disponible",
        disponibilite: "immediate",
        livraisonPossible: true,
      },
      {
        userId: bernardId,
        typeResidu: "Drêches de brasserie",
        quantityKg: 6000,
        priceFcfa: 45000,
        latitude: 5.3547,
        longitude: -4.0042,
        region: "Abidjan",
        description: "Drêches de brasserie fraîches, haute valeur nutritive pour l'alimentation animale.",
        status: "disponible",
        disponibilite: "planifiee",
        livraisonPossible: true,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`Inserted ${offers.length} offers`);
  console.log("Seeding complete!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
