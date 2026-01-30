import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Force standard TCP connection with robust SSL for external Postgres (Neon/Railway)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Revert to explicit object config which is often safer for Neon/Railway
  max: 20, // Explicitly set pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000, // Reduced timeout to fail faster
});
export const db = drizzle(pool, { schema });
