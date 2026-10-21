import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { livoPool?: Pool };

// Reuse one pool across hot reloads in development.
const pool = globalForDb.livoPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.livoPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
