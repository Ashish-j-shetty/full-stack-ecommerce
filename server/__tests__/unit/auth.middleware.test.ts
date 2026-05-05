import jwt from "jsonwebtoken";
import { NextFunction, Response } from "express";
import {
  generateToken,
  getCookieOptions,
  authenticate,
  requireAdmin,
} from "../../src/middleware/auth";
import { AuthRequest } from "../../src/types";

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { cookies: {}, ...overrides } as AuthRequest;
}

const makeRes = () => ({} as Response);
const makeNext = () => jest.fn() as jest.MockedFunction<NextFunction>;

// ---------------------------------------------------------------------------
// generateToken
// ---------------------------------------------------------------------------
describe("generateToken", () => {
  const user = { id: 1, username: "alice", role: "customer" };

  it("returns a string", () => {
    expect(typeof generateToken(user)).toBe("string");
  });

  it("decoded payload contains id, username and role", () => {
    const token = generateToken(user);
    // jwt.decode skips signature verification — we just check the payload shape
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.id).toBe(user.id);
    expect(decoded.username).toBe(user.username);
    expect(decoded.role).toBe(user.role);
  });

  it("token expires in exactly 7 days", () => {
    const token = generateToken(user);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });
});

// ---------------------------------------------------------------------------
// getCookieOptions
// ---------------------------------------------------------------------------
describe("getCookieOptions", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("httpOnly is always true", () => {
    expect(getCookieOptions().httpOnly).toBe(true);
  });

  it("secure is false outside production", () => {
    process.env.NODE_ENV = "development";
    expect(getCookieOptions().secure).toBe(false);
  });

  it("secure is true in production", () => {
    process.env.NODE_ENV = "production";
    expect(getCookieOptions().secure).toBe(true);
  });

  it("sameSite is strict", () => {
    expect(getCookieOptions().sameSite).toBe("strict");
  });

  it("maxAge is 7 days in milliseconds", () => {
    expect(getCookieOptions().maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("path is /", () => {
    expect(getCookieOptions().path).toBe("/");
  });
});

// ---------------------------------------------------------------------------
// authenticate
// ---------------------------------------------------------------------------
describe("authenticate", () => {
  it("calls next(AppError 401) when no token cookie present", () => {
    const next = makeNext();
    authenticate(makeReq({ cookies: {} }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it("calls next(AppError 401) when token is invalid", () => {
    const next = makeNext();
    authenticate(
      makeReq({ cookies: { token: "bad.token.here" } }),
      makeRes(),
      next,
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it("populates req.user and calls next() with no error for a valid token", () => {
    const user = { id: 5, username: "bob", role: "admin" as const };
    const token = generateToken(user);
    const req = makeReq({ cookies: { token } });
    const next = makeNext();

    authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments = no error
    expect(req.user).toMatchObject({ id: 5, username: "bob", role: "admin" });
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------
describe("requireAdmin", () => {
  it("calls next(AppError 403) when role is customer", () => {
    const next = makeNext();
    const req = makeReq({ user: { id: 1, username: "u", role: "customer" } });
    requireAdmin(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("calls next(AppError 403) when req.user is undefined", () => {
    const next = makeNext();
    requireAdmin(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("calls next() without error when role is admin", () => {
    const next = makeNext();
    const req = makeReq({ user: { id: 2, username: "admin", role: "admin" } });
    requireAdmin(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
