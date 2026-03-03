import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils/errors.js";
import { errorResponse } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

/**
 * Global error handler middleware.
 * Catches all errors and returns a consistent JSON response.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(`Operational error: ${err.message}`);
  } else {
    logger.error("Unexpected error:", err);
  }

  // Handle known operational errors
  // NOTE: Also check `.name` because Jest's ESM module isolation can produce two
  // separate class instances for the same module, making plain `instanceof` fail.
  if (err instanceof ValidationError || err.name === "ValidationError") {
    const validationErr = err as ValidationError;
    errorResponse(res, validationErr.message, validationErr.statusCode ?? 422, {
      errors: (validationErr as ValidationError).errors ?? {},
    });
    return;
  }

  if (err instanceof AppError || (err as AppError).statusCode !== undefined) {
    const appErr = err as AppError;
    errorResponse(res, appErr.message, appErr.statusCode);
    return;
  }

  // Handle Prisma errors
  if (err.constructor.name === "PrismaClientKnownRequestError") {
    const prismaError = err as unknown as {
      code: string;
      meta?: { target?: string[] };
    };
    switch (prismaError.code) {
      case "P2002":
        errorResponse(
          res,
          `Duplicate value for: ${prismaError.meta?.target?.join(", ") ?? "unknown field"}`,
          409,
        );
        return;
      case "P2025":
        errorResponse(res, "Record not found", 404);
        return;
      default:
        errorResponse(res, "Database error", 500);
        return;
    }
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    errorResponse(res, "Invalid token", 401);
    return;
  }

  if (err.name === "TokenExpiredError") {
    errorResponse(res, "Token expired", 401);
    return;
  }

  // Handle unexpected errors
  const message =
    process.env["NODE_ENV"] === "development"
      ? err.message
      : "Internal server error";

  errorResponse(res, message, 500);
}

/**
 * 404 handler for unknown routes.
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}
