/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Mock Prisma before any app imports ───────────────
const mockPrismaUser = {
    findUnique: jest.fn(),
    create: jest.fn(),
};

jest.unstable_mockModule("../../config/database.js", () => ({
    prisma: { user: mockPrismaUser } as unknown as PrismaClient,
    connectDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    disconnectDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// Import AFTER mock is registered
const { default: request } = await import("supertest");
const { createApp } = await import("../../app.js");
const { hashPassword, generateAccessToken, generateRefreshToken } =
    await import("../../utils/auth.js");

const app = createApp();

// ─── Test Data ────────────────────────────────────────
const TEST_USER = {
    id: "cuid-123",
    name: "Test User",
    email: "test@example.com",
    password: "", // set in beforeEach
    role: "USER",
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

beforeEach(async () => {
    jest.clearAllMocks();
    TEST_USER.password = await hashPassword("Password123");
});

// ─── POST /api/v1/auth/register ───────────────────────
describe("POST /api/v1/auth/register", () => {
    it("should register a new user (201)", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(null);
        mockPrismaUser.create.mockResolvedValue({
            id: TEST_USER.id,
            name: TEST_USER.name,
            email: TEST_USER.email,
            createdAt: TEST_USER.createdAt,
        });

        const res = await request(app).post("/api/v1/auth/register").send({
            name: "Test User",
            email: "test@example.com",
            password: "Password123",
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe("test@example.com");
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should return 409 when email already exists", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);

        const res = await request(app).post("/api/v1/auth/register").send({
            name: "Test User",
            email: "test@example.com",
            password: "Password123",
        });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });

    it("should return 422 when name is missing", async () => {
        const res = await request(app).post("/api/v1/auth/register").send({
            email: "test@example.com",
            password: "Password123",
        });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });

    it("should return 422 when email is invalid", async () => {
        const res = await request(app).post("/api/v1/auth/register").send({
            name: "Test",
            email: "not-an-email",
            password: "Password123",
        });

        expect(res.status).toBe(422);
    });

    it("should return 422 when password is too weak", async () => {
        const res = await request(app).post("/api/v1/auth/register").send({
            name: "Test",
            email: "test@example.com",
            password: "short",
        });

        expect(res.status).toBe(422);
    });
});

// ─── POST /api/v1/auth/login ──────────────────────────
describe("POST /api/v1/auth/login", () => {
    it("should login successfully (200)", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);

        const res = await request(app).post("/api/v1/auth/login").send({
            email: "test@example.com",
            password: "Password123",
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
        expect(res.body.data.user.id).toBe(TEST_USER.id);
    });

    it("should return 401 for wrong email", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(null);

        const res = await request(app).post("/api/v1/auth/login").send({
            email: "wrong@example.com",
            password: "Password123",
        });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it("should return 401 for wrong password", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);

        const res = await request(app).post("/api/v1/auth/login").send({
            email: "test@example.com",
            password: "WrongPassword1",
        });

        expect(res.status).toBe(401);
    });

    it("should return 422 when email/password is missing", async () => {
        const res = await request(app).post("/api/v1/auth/login").send({});

        expect(res.status).toBe(422);
    });
});

// ─── POST /api/v1/auth/refresh-token ──────────────────
describe("POST /api/v1/auth/refresh-token", () => {
    it("should return new tokens for a valid refresh token", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);

        const token = generateRefreshToken({
            userId: TEST_USER.id,
            email: TEST_USER.email,
        });

        const res = await request(app)
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: token });

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should return 401 when no refresh token is sent", async () => {
        const res = await request(app)
            .post("/api/v1/auth/refresh-token")
            .send({});

        expect(res.status).toBe(401);
    });

    it("should return 401 for an invalid refresh token", async () => {
        const res = await request(app)
            .post("/api/v1/auth/refresh-token")
            .send({ refreshToken: "garbage" });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/v1/auth/logout ─────────────────────────
describe("POST /api/v1/auth/logout", () => {
    it("should return 200 when authenticated", async () => {
        const token = generateAccessToken({
            userId: TEST_USER.id,
            email: TEST_USER.email,
        });

        const res = await request(app)
            .post("/api/v1/auth/logout")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("should return 401 when not authenticated", async () => {
        const res = await request(app).post("/api/v1/auth/logout");

        expect(res.status).toBe(401);
    });
});

// ─── GET /api/v1/auth/me ──────────────────────────────
describe("GET /api/v1/auth/me", () => {
    it("should return user data when authenticated (200)", async () => {
        mockPrismaUser.findUnique.mockResolvedValue({
            id: TEST_USER.id,
            name: TEST_USER.name,
            email: TEST_USER.email,
            role: TEST_USER.role,
            avatar: null,
            createdAt: TEST_USER.createdAt,
            updatedAt: TEST_USER.updatedAt,
        });

        const token = generateAccessToken({
            userId: TEST_USER.id,
            email: TEST_USER.email,
        });

        const res = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(TEST_USER.email);
    });

    it("should return 401 when no token provided", async () => {
        const res = await request(app).get("/api/v1/auth/me");

        expect(res.status).toBe(401);
    });

    it("should return 404 when user no longer exists", async () => {
        mockPrismaUser.findUnique.mockResolvedValue(null);

        const token = generateAccessToken({
            userId: "deleted-user-id",
            email: "deleted@example.com",
        });

        const res = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});
