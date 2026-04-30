import fs from "fs";
import path from "path";
import pool from "./db";
import { logger } from "../utils/logger";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, "../../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && f !== "seed.sql")
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE name = $1",
        [file],
      );
      if (rows.length > 0) {
        logger.debug(`Migration ${file} already applied, skipping`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        logger.info(`Migration ${file} applied successfully`);
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error(`Migration ${file} failed`, err);
        throw err;
      }
    }

    // Run seed
    const seedPath = path.join(migrationsDir, "seed.sql");
    if (fs.existsSync(seedPath)) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE name = $1",
        ["seed.sql"],
      );
      if (rows.length === 0) {
        const seedSql = fs.readFileSync(seedPath, "utf-8");
        await client.query("BEGIN");
        try {
          await client.query(seedSql);
          await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
            "seed.sql",
          ]);
          await client.query("COMMIT");
          logger.info("Seed data applied successfully");
        } catch (err) {
          await client.query("ROLLBACK");
          logger.error("Seed failed", err);
          throw err;
        }
      }
    }

    logger.info("All migrations complete");
  } finally {
    client.release();
  }
}

// Allow running directly: npx tsx src/config/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
