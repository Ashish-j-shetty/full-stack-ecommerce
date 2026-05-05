import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/middleware/errorHandler";
import { AppError } from "../../src/types";
import { logger } from "../../src/utils/logger";

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json };
}

describe("errorHandler", () => {
  let res: ReturnType<typeof makeRes>;
  let next: jest.MockedFunction<NextFunction>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
    loggerSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it("uses err.statusCode when err is an AppError", () => {
    const err = new AppError("Not found", 404);
    errorHandler(err, {} as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns err.message and statusCode in body for an AppError", () => {
    const err = new AppError("Not found", 404);
    errorHandler(err, {} as Request, res as unknown as Response, next);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "Not found", status: 404 },
    });
  });

  it("responds with status 500 for a generic Error", () => {
    const err = new Error("boom");
    errorHandler(err, {} as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns "Internal server error" in body for a generic Error', () => {
    const err = new Error("boom");
    errorHandler(err, {} as Request, res as unknown as Response, next);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "Internal server error", status: 500 },
    });
  });

  it("calls logger.error for a generic Error", () => {
    const err = new Error("boom");
    errorHandler(err, {} as Request, res as unknown as Response, next);
    expect(loggerSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT call logger.error for an AppError", () => {
    const err = new AppError("Bad request", 400);
    errorHandler(err, {} as Request, res as unknown as Response, next);
    expect(loggerSpy).not.toHaveBeenCalled();
  });
});
