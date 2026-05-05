import { Request, Response, NextFunction } from "express";
import { securityHeaders } from "../../src/middleware/securityHeaders";

function makeRes() {
  const headers: Record<string, string> = {};
  const setHeader = jest.fn((name: string, value: string) => {
    headers[name] = value;
  });
  return { setHeader, headers };
}

describe("securityHeaders", () => {
  let res: ReturnType<typeof makeRes>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
    securityHeaders({} as Request, res as unknown as Response, next);
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
  });

  it("sets X-Frame-Options to DENY", () => {
    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
  });

  it("sets X-XSS-Protection to 0", () => {
    expect(res.setHeader).toHaveBeenCalledWith("X-XSS-Protection", "0");
  });

  it("sets Referrer-Policy to strict-origin-when-cross-origin", () => {
    expect(res.setHeader).toHaveBeenCalledWith(
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );
  });

  it("calls next() exactly once", () => {
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() without an error argument", () => {
    expect(next).toHaveBeenCalledWith();
  });
});
