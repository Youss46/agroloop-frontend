import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const hash = (password: string) => bcrypt.hashSync(password, 10);

const DEMO_PASSWORD = "demo1234";

async function seedDemo() {
  console.log("Ajout des comptes démo...");

  const demoUsers = await db
    .insert(schema.usersTable)
    .values([
      {
        name: "Démo Producteur",
        email: "demo.producteur@agroloop.ci",
        passwordHash: hash(DEMO_PASSWORD),
        role: "producteur",
        phone: "+225 0700000001",
        region: "Abidjan",
        bio: "Compte de démonstration — Producteur",
        filieres: ["cacao", "plantain"],
        verificationStatus: "verifie",
        verificationLevel: 2,
      },
      {
        name: "Démo Transformateur",
        email: "demo.transformateur@agroloop.ci",
        passwordHash: hash(DEMO_PASSWORD),
        role: "transformateur",
        phone: "+225 0700000002",
        region: "Abidjan",
        bio: "Compte de démonstration — Transformateur",
        filieres: ["anacarde", "cacao"],
        verificationStatus: "verifie",
        verificationLevel: 2,
      },
      {
        name: "Démo Admin",
        email: "demo.admin@agroloop.ci",
        passwordHash: hash(DEMO_PASSWORD),
        role: "admin",
        phone: "+225 0700000003",
        region: "Abidjan",
        bio: "Compte de démonstration — Administrateur",
        filieres: [],
        verificationStatus: "verifie",
        verificationLevel: 3,
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (demoUsers.length === 0) {
    console.log("Les comptes démo existent déjà.");
  } else {
    console.log(`${demoUsers.length} compte(s) démo créé(s) :`);
    demoUsers.forEach((u) => {
      console.log(`  - [${u.role}] ${u.name} <${u.email}> | mot de passe : ${DEMO_PASSWORD}`);
    });
  }

  console.log("\nRécapitulatif des comptes démo :");
  console.log("  Producteur  : demo.producteur@agroloop.ci  /  demo1234");
  console.log("  Transformateur : demo.transformateur@agroloop.ci  /  demo1234");
  console.log("  Admin       : demo.admin@agroloop.ci  /  demo1234");

  await pool.end();
}

seedDemo().catch((err) => {
  console.error("Échec :", err);
  process.exit(1);
});
