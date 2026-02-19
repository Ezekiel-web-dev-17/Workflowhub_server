import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

describe("Health Check", () => {
    it("GET /api/v1/health should return 200", async () => {
        const response = await request(app).get("/api/v1/health");

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe("healthy");
    });
});

describe("404 Handler", () => {
    it("should return 404 for unknown routes", async () => {
        const response = await request(app).get("/api/v1/nonexistent");

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
    });
});
