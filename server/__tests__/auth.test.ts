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

describe("POST /api/auth/register", () => {
  it("creates a new user and sets cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")

      .send({
        username: "newuser",
        email: "new@test.com",
        password: "password123",
      });

    expect(res.status).toBe(201);

    expect(res.body.user).toMatchObject({
      username: "newuser",

      email: "new@test.com",

      role: "customer",
    });

    expect(res.headers["set-cookie"]).toBeDefined();

    expect(res.headers["set-cookie"][0]).toMatch(/token=/);
  });

  it("rejects duplicate username", async () => {
    // First register

    await request(app)
      .post("/api/auth/register")

      .send({
        username: "dupeuser",
        email: "dupe1@test.com",
        password: "password123",
      });

    // Second register with same username

    const res = await request(app)
      .post("/api/auth/register")

      .send({
        username: "dupeuser",
        email: "dupe2@test.com",
        password: "password123",
      });

    expect(res.status).toBe(409);

    expect(res.body.error.message).toMatch(/already taken/i);
  });

  it("rejects short username", async () => {
    const res = await request(app)
      .post("/api/auth/register")

      .send({
        username: "ab",
        email: "short@test.com",
        password: "password123",
      });

    expect(res.status).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")

      .send({ username: "shortpw", email: "pw@test.com", password: "1234567" });

    expect(res.status).toBe(400);
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")

      .send({
        username: "bademail",
        email: "invalid",
        password: "password123",
      });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/auth/register")

      .send({
        username: "loginuser",
        email: "login@test.com",
        password: "password123",
      });
  });

  it("logs in with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")

      .send({ username: "loginuser", password: "password123" });

    expect(res.status).toBe(200);

    expect(res.body.user.username).toBe("loginuser");

    expect(res.headers["set-cookie"][0]).toMatch(/token=/);
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")

      .send({ username: "loginuser", password: "wrongpassword" });

    expect(res.status).toBe(401);

    expect(res.body.error.message).toMatch(/invalid credentials/i);
  });

  it("rejects non-existent user", async () => {
    const res = await request(app)
      .post("/api/auth/login")

      .send({ username: "nouser", password: "password123" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user data with valid cookie", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")

      .send({
        username: "meuser",
        email: "me@test.com",
        password: "password123",
      });

    const cookie = registerRes.headers["set-cookie"];

    const res = await request(app)
      .get("/api/auth/me")

      .set("Cookie", cookie);

    expect(res.status).toBe(200);

    expect(res.body.user.username).toBe("meuser");
  });

  it("returns 401 without cookie", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the token cookie", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);

    expect(res.body.message).toMatch(/logged out/i);
  });
});
