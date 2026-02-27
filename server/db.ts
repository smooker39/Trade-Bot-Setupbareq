import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// ✅ FIX: Self-Healing Pool مع إعادة الاتصال التلقائية
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // ✅ SSL مطلوب لـ Render PostgreSQL
  ssl: process.env.DATABASE_URL.includes("render.com") || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// ✅ Self-Healing: إعادة الاتصال عند قطع الاتصال
pool.on("error", (err) => {
  console.error("❌ [DB POOL] Unexpected error:", err.message);
});

pool.on("connect", () => {
  console.log("✅ [DB POOL] New connection established");
});

// ✅ اختبار الاتصال عند البدء مع retry
async function connectWithRetry(retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("✅ [DB] Database connection verified");
      return;
    } catch (err: any) {
      console.error(`❌ [DB] Connection attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error("❌ [DB] All connection attempts failed. Check DATABASE_URL.");
      }
    }
  }
}

connectWithRetry();

export const db = drizzle(pool, { schema });