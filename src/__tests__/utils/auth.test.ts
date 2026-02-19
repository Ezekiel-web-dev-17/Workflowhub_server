import { describe, it, expect } from "@jest/globals";
import {
    hashPassword,
    comparePassword,
    generateAccessToken,
    verifyAccessToken,
} from "../../utils/auth.js";

describe("Auth Utilities", () => {
    describe("Password Hashing", () => {
        it("should hash a password", async () => {
            const password = "TestPassword123";
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
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

    describe("JWT Tokens", () => {
        const payload = {
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

        it("should reject an invalid token", () => {
            expect(() => verifyAccessToken("invalid-token")).toThrow();
        });
    });
});
