import { describe, it, expect, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { generateAccessToken, type TokenPayload } from "../../utils/auth.js";

// ─── Helpers ──────────────────────────────────────────
function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe("authenticate middleware", () => {
  const payload: TokenPayload = {
    userId: "user-123",
    email: "test@example.com",
    role: "USER",
  };

  it("should set req.user and call next() for a valid Bearer token", () => {
    const token = generateAccessToken(payload);
    const req = mockReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(payload.userId);
    expect(req.user!.email).toBe(payload.email);
  });

  it("should call next with UnauthorizedError when no Authorization header", () => {
    const req = mockReq();
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UnauthorizedError" }),
    );
  });

  it("should call next with UnauthorizedError when header is not Bearer", () => {
    const req = mockReq({
      headers: { authorization: "Basic abc123" },
    });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UnauthorizedError" }),
    );
  });

  it("should call next with UnauthorizedError for an invalid token", () => {
    const req = mockReq({
      headers: { authorization: "Bearer invalid-token" },
    });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UnauthorizedError" }),
    );
  });
});

describe("authorize middleware", () => {
  it("should call next() when user has an allowed role", () => {
    const req = mockReq();
    req.user = { userId: "u1", email: "a@b.com", role: "ADMIN" };
    const next = jest.fn() as unknown as NextFunction;

    authorize("ADMIN", "USER")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should call next with UnauthorizedError when role is not allowed", () => {
    const req = mockReq();
    req.user = { userId: "u1", email: "a@b.com", role: "USER" };
    const next = jest.fn() as unknown as NextFunction;

    authorize("ADMIN")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UnauthorizedError" }),
    );
  });

  it("should call next with UnauthorizedError when req.user is undefined", () => {
    const req = mockReq();
    const next = jest.fn() as unknown as NextFunction;

    authorize("ADMIN")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UnauthorizedError" }),
    );
  });

  it("should call next with UnauthorizedError when user has no role", () => {
    const req = mockReq();
    req.user = { userId: "u1", email: "a@b.com" }; // role is undefined
    const next = jest.fn() as unknown as NextFunction;

    authorize("ADMIN")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UnauthorizedError" }),
    );
  });
});
