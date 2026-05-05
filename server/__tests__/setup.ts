import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { createApp } from "../src/app";
import express from "express";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL environment variable is required");
}

export const testPool = new Pool({ connectionString: TEST_DATABASE_URL });

// Override the db module's pool for tests
jest.mock("../src/config/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factory cannot use import()
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  return {
    __esModule: true,
    default: pool,
    connectWithRetry: jest.fn().mockResolvedValue(undefined),
  };
});

export function getApp(): express.Express {
  return createApp();
}

export async function setupTestDb(): Promise<void> {
  const migrationsDir = path.join(__dirname, "../migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f !== "seed.sql")
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    await testPool.query(sql);
  }
}

export async function seedTestDb(): Promise<void> {
  const seedPath = path.join(__dirname, "../migrations/seed.sql");
  const sql = fs.readFileSync(seedPath, "utf-8");
  await testPool.query(sql);
}

export async function truncateAll(): Promise<void> {
  await testPool.query(`
    TRUNCATE cart_items, order_items, orders, products, users, _migrations RESTART IDENTITY CASCADE
  `);
}

export async function teardownTestDb(): Promise<void> {
  await testPool.query(`
    DROP TABLE IF EXISTS cart_items, order_items, orders, products, users, _migrations CASCADE
  `);
  await testPool.end();
}
