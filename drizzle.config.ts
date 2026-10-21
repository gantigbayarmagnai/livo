import { defineConfig } from "drizzle-kit";

// Load .env for drizzle-kit commands (Node 20.12+).
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
