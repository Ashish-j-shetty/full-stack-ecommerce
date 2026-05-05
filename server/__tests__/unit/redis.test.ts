import {
  getCache,
  setCache,
  clearCache,
  disconnectRedis,
} from "../../src/config/redis";

// When ENABLE_REDIS is not "true", all helpers are safe no-ops that require
// no Redis connection.
describe("Redis cache helpers (Redis disabled)", () => {
  beforeAll(() => {
    delete process.env.ENABLE_REDIS;
  });

  it("getCache returns null for any key", async () => {
    await expect(getCache("some-key")).resolves.toBeNull();
  });

  it("setCache resolves without error", async () => {
    await expect(setCache("some-key", { a: 1 }, 60)).resolves.toBeUndefined();
  });

  it("clearCache resolves without error", async () => {
    await expect(clearCache("products:*")).resolves.toBeUndefined();
  });

  it("disconnectRedis resolves without error", async () => {
    await expect(disconnectRedis()).resolves.toBeUndefined();
  });
});
