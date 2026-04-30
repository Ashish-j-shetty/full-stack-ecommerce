import { Request, Response, NextFunction } from "express";
import { AppError } from "../types";
import { logger } from "../utils/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { message: err.message, status: err.statusCode },
    });
    return;
  }

  logger.error("Unhandled error", { message: err.message, stack: err.stack });

  res.status(500).json({
    error: { message: "Internal server error", status: 500 },
  });
}
