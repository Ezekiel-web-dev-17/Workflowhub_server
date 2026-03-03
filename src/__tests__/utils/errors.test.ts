import { describe, it, expect } from "@jest/globals";
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
} from "../../utils/errors.js";

describe("Custom Error Classes", () => {
  describe("AppError", () => {
    it("should default to 500 status and operational", () => {
      const error = new AppError("Something broke");

      expect(error.message).toBe("Something broke");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should accept custom statusCode and isOperational", () => {
      const error = new AppError("Fatal", 503, false);

      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(false);
    });
  });

  describe("BadRequestError", () => {
    it("should have status 400", () => {
      const error = new BadRequestError("Bad input");

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Bad input");
      expect(error).toBeInstanceOf(AppError);
    });

    it("should have a default message", () => {
      const error = new BadRequestError();

      expect(error.message).toBe("Bad request");
    });
  });

  describe("UnauthorizedError", () => {
    it("should have status 401", () => {
      const error = new UnauthorizedError("No token");

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("No token");
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe("ForbiddenError", () => {
    it("should have status 403", () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("Forbidden");
    });
  });

  describe("NotFoundError", () => {
    it("should have status 404", () => {
      const error = new NotFoundError("User not found");

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("User not found");
    });
  });

  describe("ConflictError", () => {
    it("should have status 409", () => {
      const error = new ConflictError("Email taken");

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe("Email taken");
    });
  });

  describe("ValidationError", () => {
    it("should have status 422 and store field errors", () => {
      const fieldErrors = {
        email: ["Email is required"],
        password: ["Too short", "Needs uppercase"],
      };
      const error = new ValidationError("Validation failed", fieldErrors);

      expect(error.statusCode).toBe(422);
      expect(error.errors).toEqual(fieldErrors);
      expect(error.errors.password).toHaveLength(2);
    });

    it("should default to empty errors object", () => {
      const error = new ValidationError();

      expect(error.errors).toEqual({});
    });
  });

  describe("TooManyRequestsError", () => {
    it("should have status 429", () => {
      const error = new TooManyRequestsError();

      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Too many requests");
    });
  });
});
