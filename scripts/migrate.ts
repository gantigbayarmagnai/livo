/**
 * Applies any pending database migrations from ./drizzle, then exits.
 * Runs on every container start (see Dockerfile), so a deploy that changes
 * the schema updates the database before the new code takes traffic.
 * Safe to run repeatedly: applied migrations are skipped.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 1 });
  // Retry while the database is still starting (first deploy).
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("select 1");
      break;
    } catch (e) {
      if (attempt >= 20) throw e;
      console.log(`Waiting for the database (attempt ${attempt})…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await migrate(drizzle(pool), { migrationsFolder: process.env.MIGRATIONS_DIR || "./drizzle" });
  console.log("Database is up to date.");
  await pool.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
