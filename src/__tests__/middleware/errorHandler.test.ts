import { describe, it, expect, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { errorHandler, notFoundHandler } from "../../middleware/errorHandler.js";
import {
    ValidationError,
    UnauthorizedError,
    NotFoundError,
} from "../../utils/errors.js";

// ─── Helpers ──────────────────────────────────────────
function mockReq(overrides: Partial<Request> = {}): Request {
    return {
        method: "GET",
        originalUrl: "/api/v1/test",
        ...overrides,
    } as unknown as Request;
}

function mockRes(): Response & { _status: number; _body: unknown } {
    const res = {
        _status: 0,
        _body: undefined as unknown,
        status(code: number) {
            res._status = code;
            return res;
        },
        json(body: unknown) {
            res._body = body;
            return res;
        },
    } as unknown as Response & { _status: number; _body: unknown };
    return res;
}

const noopNext = jest.fn() as unknown as NextFunction;

describe("errorHandler", () => {
    it("should return 422 with field errors for ValidationError", () => {
        const fieldErrors = { email: ["Email is required"] };
        const err = new ValidationError("Validation failed", fieldErrors);
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(422);
        const body = res._body as { success: boolean; data: { errors: typeof fieldErrors } };
        expect(body.success).toBe(false);
        expect(body.data.errors).toEqual(fieldErrors);
    });

    it("should return the correct status code for AppError subclasses", () => {
        const err = new NotFoundError("User not found");
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(404);
        const body = res._body as { success: boolean; message: string };
        expect(body.success).toBe(false);
        expect(body.message).toBe("User not found");
    });

    it("should return 401 for UnauthorizedError", () => {
        const err = new UnauthorizedError("No token");
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(401);
    });

    it("should return 401 for JsonWebTokenError", () => {
        const err = new Error("jwt malformed");
        err.name = "JsonWebTokenError";
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(401);
        const body = res._body as { message: string };
        expect(body.message).toBe("Invalid token");
    });

    it("should return 401 for TokenExpiredError", () => {
        const err = new Error("jwt expired");
        err.name = "TokenExpiredError";
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(401);
        const body = res._body as { message: string };
        expect(body.message).toBe("Token expired");
    });

    it("should return 409 for Prisma duplicate error (P2002)", () => {
        const err = Object.assign(new Error("Unique constraint"), {
            code: "P2002",
            meta: { target: ["email"] },
        });
        Object.defineProperty(err, "constructor", {
            value: { name: "PrismaClientKnownRequestError" },
        });
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(409);
    });

    it("should return 404 for Prisma not-found error (P2025)", () => {
        const err = Object.assign(new Error("Record not found"), {
            code: "P2025",
        });
        Object.defineProperty(err, "constructor", {
            value: { name: "PrismaClientKnownRequestError" },
        });
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(404);
    });

    it("should return 500 for unknown errors", () => {
        const err = new Error("Something unexpected");
        const res = mockRes();

        errorHandler(err, mockReq(), res, noopNext);

        expect(res._status).toBe(500);
    });
});

describe("notFoundHandler", () => {
    it("should return 404 with method and URL in the message", () => {
        const req = mockReq({ method: "POST", originalUrl: "/api/v1/missing" });
        const res = mockRes();

        notFoundHandler(req, res, noopNext);

        expect(res._status).toBe(404);
        const body = res._body as { success: boolean; message: string };
        expect(body.success).toBe(false);
        expect(body.message).toContain("POST");
        expect(body.message).toContain("/api/v1/missing");
    });
});
