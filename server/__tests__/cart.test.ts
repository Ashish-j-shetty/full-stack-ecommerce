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
let authCookie: string[];

async function loginAsCustomer(): Promise<string[]> {
  await request(app).post("/api/auth/register").send({
    username: "cartuser",
    email: "cart@test.com",
    password: "password123",
  });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "cartuser", password: "password123" });

  return loginRes.headers["set-cookie"] as unknown as string[];
}

async function getFirstProductId(): Promise<number> {
  const res = await request(app).get("/api/products?limit=1");
  return res.body.data[0].id;
}

beforeAll(async () => {
  await setupTestDb();
  await seedTestDb();
  app = getApp();
});

beforeEach(async () => {
  await truncateAll();
  await seedTestDb();
  authCookie = await loginAsCustomer();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/cart", () => {
  it("returns empty cart for new user", async () => {
    const res = await request(app).get("/api/cart").set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/cart", () => {
  it("adds item to cart", async () => {
    const productId = await getFirstProductId();

    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product_id).toBe(productId);
    expect(res.body.items[0].quantity).toBe(2);
  });

  it("increments quantity on duplicate add (UPSERT)", async () => {
    const productId = await getFirstProductId();

    await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(4); // 1 + 3
  });

  it("rejects invalid product ID", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId: 99999, quantity: 1 });

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/cart/:productId", () => {
  it("updates item quantity", async () => {
    const productId = await getFirstProductId();

    await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .put(`/api/cart/${productId}`)
      .set("Cookie", authCookie)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.items[0].quantity).toBe(5);
  });

  it("removes item when quantity is 0", async () => {
    const productId = await getFirstProductId();

    await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .put(`/api/cart/${productId}`)
      .set("Cookie", authCookie)
      .send({ quantity: 0 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});

describe("DELETE /api/cart/:productId", () => {
  it("removes item from cart", async () => {
    const productId = await getFirstProductId();

    await request(app)
      .post("/api/cart")
      .set("Cookie", authCookie)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .delete(`/api/cart/${productId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
  });

  it("returns 404 for item not in cart", async () => {
    const res = await request(app)
      .delete("/api/cart/99999")
      .set("Cookie", authCookie);

    expect(res.status).toBe(404);
  });
});
