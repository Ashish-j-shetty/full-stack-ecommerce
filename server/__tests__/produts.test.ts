import request from "supertest";
import {
  getApp,
  setupTestDb,
  seedTestDb,
  truncateAll,
  teardownTestDb,
} from "./setup";
import express from "express";

let app: express.Express;

beforeAll(async () => {
  await setupTestDb();
  await seedTestDb();
  app = getApp();
});

afterEach(async () => {
  await truncateAll();
  await seedTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/products", () => {
  it("returns paginated products", async () => {
    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("totalPages");
  });

  it("filters by category", async () => {
    const res = await request(app).get("/api/products?category=Electronics");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((p: { category: string }) => {
      expect(p.category).toBe("Electronics");
    });
  });

  it("searches by name", async () => {
    const res = await request(app).get("/api/products?search=headphones");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("returns empty for non-matching search", async () => {
    const res = await request(app).get("/api/products?search=xyznonexistent");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("paginates correctly", async () => {
    const res = await request(app).get("/api/products?page=1&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBeGreaterThan(1);
  });
});

describe("GET /api/products/categories", () => {
  it("returns available categories", async () => {
    const res = await request(app).get("/api/products/categories");

    expect(res.status).toBe(200);
    expect(res.body.categories).toBeInstanceOf(Array);
    expect(res.body.categories).toContain("Electronics");
    expect(res.body.categories).toContain("Books");
  });
});

describe("GET /api/products/:id", () => {
  it("returns a single product", async () => {
    // First get the list to find a valid ID
    const listRes = await request(app).get("/api/products?limit=1");
    const productId = listRes.body.data[0].id;

    const res = await request(app).get(`/api/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.product).toHaveProperty("id", productId);
    expect(res.body.product).toHaveProperty("name");
    expect(res.body.product).toHaveProperty("price");
  });

  it("returns 404 for non-existent product", async () => {
    const res = await request(app).get("/api/products/99999");

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await request(app).get("/api/products/abc");

    expect(res.status).toBe(400);
  });
});
