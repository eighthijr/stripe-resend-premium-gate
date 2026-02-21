import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { getEnv } from "@/lib/env";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const env = getEnv();
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

  return pool;
}

export type DbExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<T>>;
};

export async function withSerializableTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
) {
  return getPool().query<T>(text, params);
}
