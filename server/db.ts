import dns from "dns";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { Pool as PgPool } from "pg";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

dns.setDefaultResultOrder("ipv4first");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const hostname = new URL(databaseUrl).hostname;
const dbTransport = (process.env.DB_TRANSPORT ?? "tcp").toLowerCase();
const useNeonWebsocket = dbTransport === "ws";

let pool: PgPool | NeonPool;
let db: unknown;

if (useNeonWebsocket) {
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
  db = drizzleNeon(pool, { schema });
} else {
  pool = new PgPool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
  db = drizzleNodePg(pool, { schema });
}

export { pool, db };
