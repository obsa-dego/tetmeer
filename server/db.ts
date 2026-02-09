import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export const db = drizzle(pool, { schema });

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing database pool...");
  await closeDatabasePool();
  process.exit(0);
});
