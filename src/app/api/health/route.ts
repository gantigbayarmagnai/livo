import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

/** Render's health check: the app is up and can reach the database. */
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
