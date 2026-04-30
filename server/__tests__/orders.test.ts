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
    username: "orderuser",
    email: "order@test.com",
    password: "password123",
  });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "orderuser", password: "password123" });

  return loginRes.headers["set-cookie"];
}

async function getFirstProductId(): Promise<number> {
  const res = await request(app).get("/api/products?limit=1");
  return res.body.data[0].id;
}

async function addToCart(productId: number, quantity: number): Promise<void> {
  await request(app)
    .post("/api/cart")
    .set("Cookie", authCookie)
    .send({ productId, quantity });
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

const validAddress = {
  name: "John Doe",
  address: "123 Test St",
  city: "TestCity",
  zip: "12345",
};

describe("POST /api/orders", () => {
  it("places order from cart and clears cart", async () => {
    const productId = await getFirstProductId();
    await addToCart(productId, 2);

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: validAddress });

    expect(res.status).toBe(201);
    expect(res.body.order).toHaveProperty("id");
    expect(res.body.order).toHaveProperty("total");
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0].quantity).toBe(2);
    expect(res.body.order.status).toBe("pending");

    // Cart should be empty after ordering
    const cartRes = await request(app)
      .get("/api/cart")
      .set("Cookie", authCookie);
    expect(cartRes.body.items).toHaveLength(0);
  });

  it("decrements product stock after order", async () => {
    const productId = await getFirstProductId();

    // Get initial stock
    const beforeRes = await request(app).get(`/api/products/${productId}`);
    const initialStock = beforeRes.body.product.stock;

    await addToCart(productId, 3);
    await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: validAddress });

    // Check stock decreased
    const afterRes = await request(app).get(`/api/products/${productId}`);
    expect(afterRes.body.product.stock).toBe(initialStock - 3);
  });

  it("rejects order with empty cart", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: validAddress });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/empty/i);
  });

  it("rejects order with missing address fields", async () => {
    const productId = await getFirstProductId();
    await addToCart(productId, 1);

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: { name: "John" } });

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ shippingAddress: validAddress });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/orders", () => {
  it("returns user orders", async () => {
    const productId = await getFirstProductId();
    await addToCart(productId, 1);
    await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: validAddress });

    const res = await request(app).get("/api/orders").set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0]).toHaveProperty("item_count");
  });

  it("returns empty array for user with no orders", async () => {
    const res = await request(app).get("/api/orders").set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(0);
  });
});

describe("GET /api/orders/:id", () => {
  it("returns order with items", async () => {
    const productId = await getFirstProductId();
    await addToCart(productId, 2);

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: validAddress });

    const orderId = orderRes.body.order.id;

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.order.items).toBeInstanceOf(Array);
    expect(res.body.order.items.length).toBeGreaterThan(0);
  });

  it("returns 404 for other user order", async () => {
    const productId = await getFirstProductId();
    await addToCart(productId, 1);

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Cookie", authCookie)
      .send({ shippingAddress: validAddress });

    const orderId = orderRes.body.order.id;

    // Register and login as another user
    await request(app).post("/api/auth/register").send({
      username: "otheruser",
      email: "other@test.com",
      password: "password123",
    });

    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "otheruser", password: "password123" });

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Cookie", otherLogin.headers["set-cookie"]);

    expect(res.status).toBe(404);
  });
});
