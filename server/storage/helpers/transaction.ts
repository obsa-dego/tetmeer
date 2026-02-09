import { pool } from "../../db";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export async function withTransaction<T>(fn: (tx: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txDb = drizzle(client, { schema });
    const result = await fn(txDb);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
