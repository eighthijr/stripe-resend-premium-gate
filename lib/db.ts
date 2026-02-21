import { Pool, PoolClient, QueryResult } from "pg";
import { env } from "@/lib/env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

export type DbExecutor = {
  query<T = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<QueryResult<T>>;
};

export async function withSerializableTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T = unknown>(text: string, params?: ReadonlyArray<unknown>) {
  return pool.query<T>(text, params);
}
