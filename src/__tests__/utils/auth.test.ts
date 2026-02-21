import { describe, it, expect } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
    hashPassword,
    comparePassword,
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    type TokenPayload,
} from "../../utils/auth.js";

describe("Auth Utilities", () => {
    // ─── Password Hashing ─────────────────────────────────
    describe("Password Hashing", () => {
        it("should hash a password", async () => {
            const password = "TestPassword123";
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
        });

        it("should produce different hashes for the same password", async () => {
            const password = "TestPassword123";
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            expect(hash1).not.toBe(hash2); // bcrypt uses unique salts
        });

        it("should verify a correct password", async () => {
            const password = "TestPassword123";
            const hash = await hashPassword(password);
            const isValid = await comparePassword(password, hash);

            expect(isValid).toBe(true);
        });

        it("should reject an incorrect password", async () => {
            const password = "TestPassword123";
            const hash = await hashPassword(password);
            const isValid = await comparePassword("WrongPassword", hash);

            expect(isValid).toBe(false);
        });
    });

    // ─── Access Tokens ────────────────────────────────────
    describe("Access Tokens", () => {
        const payload: TokenPayload = {
            userId: "test-user-id",
            email: "test@example.com",
            role: "USER",
        };

        it("should generate and verify an access token", () => {
            const token = generateAccessToken(payload);
            const decoded = verifyAccessToken(token);

            expect(decoded.userId).toBe(payload.userId);
            expect(decoded.email).toBe(payload.email);
        });

        it("should include the role in the decoded token", () => {
            const token = generateAccessToken(payload);
            const decoded = verifyAccessToken(token);

            expect(decoded.role).toBe("USER");
        });

        it("should reject an invalid token", () => {
            expect(() => verifyAccessToken("invalid-token")).toThrow();
        });

        it("should reject a token signed with a different secret", () => {
            const fakeToken = jwt.sign(payload, "wrong-secret", {
                expiresIn: "1h",
            });

            expect(() => verifyAccessToken(fakeToken)).toThrow();
        });

        it("should reject an expired token", () => {
            const expiredToken = jwt.sign(
                payload,
                process.env["JWT_SECRET"]!,
                { expiresIn: "0s" }
            );

            expect(() => verifyAccessToken(expiredToken)).toThrow();
        });
    });

    // ─── Refresh Tokens ───────────────────────────────────
    describe("Refresh Tokens", () => {
        const payload: TokenPayload = {
            userId: "test-user-id",
            email: "test@example.com",
            role: "ADMIN",
        };

        it("should generate and verify a refresh token", () => {
            const token = generateRefreshToken(payload);
            const decoded = verifyRefreshToken(token);

            expect(decoded.userId).toBe(payload.userId);
            expect(decoded.email).toBe(payload.email);
        });

        it("should reject an invalid refresh token", () => {
            expect(() => verifyRefreshToken("garbage-value")).toThrow();
        });

        it("should reject an access token used as a refresh token", () => {
            // Access token is signed with JWT_SECRET, refresh uses JWT_REFRESH_SECRET
            const accessToken = generateAccessToken(payload);

            expect(() => verifyRefreshToken(accessToken)).toThrow();
        });

        it("should reject a refresh token used as an access token", () => {
            const refreshToken = generateRefreshToken(payload);

            expect(() => verifyAccessToken(refreshToken)).toThrow();
        });
    });
});
