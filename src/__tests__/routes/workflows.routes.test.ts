/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Mock Prisma before any app imports ───────────────────────────────────────
// We mock the entire database module so no real DB connection is made.
// Each model gets its own set of jest.fn() stubs that we can configure per test.
const mockWorkflow = {
    findMany: jest.fn<() => Promise<unknown>>(),
    count: jest.fn<() => Promise<unknown>>(),
    findUnique: jest.fn<() => Promise<unknown>>(),
    create: jest.fn<() => Promise<unknown>>(),
    update: jest.fn<() => Promise<unknown>>(),
    delete: jest.fn<() => Promise<unknown>>(),
};
const mockStep = { deleteMany: jest.fn<() => Promise<unknown>>() };
const mockComment = { create: jest.fn<() => Promise<unknown>>() };

jest.unstable_mockModule("../../config/database.js", () => ({
    prisma: {
        workflow: mockWorkflow,
        step: mockStep,
        comment: mockComment,
        // Minimal $transaction: executes the callback with the same mock client
        $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
            fn({
                workflow: mockWorkflow,
                step: mockStep,
                comment: mockComment,
            })
        ),
    } as unknown as PrismaClient,
    connectDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    disconnectDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// ─── Import AFTER mocks are registered ───────────────────────────────────────
const { default: request } = await import("supertest");
const { createApp } = await import("../../app.js");
const { generateAccessToken } = await import("../../utils/auth.js");

const app = createApp();

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const AUTHOR = {
    id: "user-cuid-001",
    name: "Alice",
    avatar: null,
};

/** A fully-published workflow returned by the DB. */
const PUBLISHED_WORKFLOW = {
    id: "wf-cuid-001",
    title: "My Workflow",
    role: "Engineer",
    description: "A great workflow",
    toolStack: ["VSCode", "GitHub"],
    insight: "Very insightful",
    result: "Saves 2 hours/day",
    setupTime: "30 mins",
    isDraft: false,
    likes: 0,
    views: 0,
    clones: 0,
    authorId: AUTHOR.id,
    author: AUTHOR,
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const DRAFT_WORKFLOW = { ...PUBLISHED_WORKFLOW, id: "wf-cuid-002", isDraft: true };

/** A valid JWT belonging to AUTHOR. */
const authHeader = () =>
    `Bearer ${generateAccessToken({ userId: AUTHOR.id, email: "alice@example.com" })}`;

/** A JWT belonging to a different user (used to test ownership). */
const otherUserToken = () =>
    `Bearer ${generateAccessToken({ userId: "user-other-999", email: "other@example.com" })}`;

beforeEach(() => {
    jest.clearAllMocks();
    // Default list/count stubs so public GET tests don't need repetitive setup
    mockWorkflow.findMany.mockResolvedValue([PUBLISHED_WORKFLOW]);
    mockWorkflow.count.mockResolvedValue(1);
});

// ─── GET /api/v1/workflows ────────────────────────────────────────────────────
describe("GET /api/v1/workflows", () => {
    it("returns a paginated list of published workflows (200)", async () => {
        // Anyone — no token needed — should be able to browse the workflow list
        const res = await request(app).get("/api/v1/workflows");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // The response should include pagination metadata alongside the data array
        expect(res.body.meta).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data[0].title).toBe(PUBLISHED_WORKFLOW.title);
    });

    it("accepts valid sort and pagination query params (200)", async () => {
        // The schema accepts: orderBy=trending|top-rated|newest, page, limit
        const res = await request(app)
            .get("/api/v1/workflows")
            .query({ orderBy: "top-rated", page: 1, limit: 5 });

        expect(res.status).toBe(200);
    });

    it("rejects an unknown orderBy value with a validation error (422)", async () => {
        // Zod enum validation always returns 422 (Unprocessable Entity), not 400
        const res = await request(app)
            .get("/api/v1/workflows")
            .query({ orderBy: "invalid-order" });

        expect(res.status).toBe(422);
    });
});

// ─── GET /api/v1/workflows/search ────────────────────────────────────────────
describe("GET /api/v1/workflows/search", () => {
    it("returns matching workflows when a search filter is provided (200)", async () => {
        const res = await request(app)
            .get("/api/v1/workflows/search")
            .query({ title: "My Workflow" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("rejects requests with no filter at all (400)", async () => {
        // At least one of title, role, category, or toolStack must be provided
        const res = await request(app).get("/api/v1/workflows/search");

        expect(res.status).toBe(400);
    });

    it("accepts a role filter (200)", async () => {
        const res = await request(app)
            .get("/api/v1/workflows/search")
            .query({ role: "Engineer" });

        expect(res.status).toBe(200);
    });
});

// ─── GET /api/v1/workflows/:id ───────────────────────────────────────────────
describe("GET /api/v1/workflows/:id", () => {
    it("returns a single workflow by its ID (200)", async () => {
        mockWorkflow.findUnique.mockResolvedValue(PUBLISHED_WORKFLOW);

        const res = await request(app).get(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(PUBLISHED_WORKFLOW.id);
    });

    it("returns 404 when no workflow with that ID exists", async () => {
        // The service throws NotFoundError when findUnique returns null
        mockWorkflow.findUnique.mockResolvedValue(null);

        const res = await request(app).get("/api/v1/workflows/does-not-exist");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});

// ─── POST /api/v1/workflows ───────────────────────────────────────────────────
describe("POST /api/v1/workflows", () => {
    it("creates a draft workflow with just a title (201)", async () => {
        // Drafts only require a title — all other fields are optional while saving
        mockWorkflow.create.mockResolvedValue(DRAFT_WORKFLOW);

        const res = await request(app)
            .post("/api/v1/workflows")
            .set("Authorization", authHeader())
            .send({ title: "My Workflow", isDraft: true });

        expect(res.status).toBe(201);
        expect(res.body.data.isDraft).toBe(true);
    });

    it("creates a published workflow when all required fields are present (201)", async () => {
        // Publishing requires: role, toolStack, insight, description, setupTime, result, steps
        mockWorkflow.create.mockResolvedValue(PUBLISHED_WORKFLOW);

        const res = await request(app)
            .post("/api/v1/workflows")
            .set("Authorization", authHeader())
            .send({
                title: "My Workflow",
                isDraft: false,
                role: "Engineer",
                description: "A great workflow",
                toolStack: ["VSCode"],
                insight: "Very insightful",
                result: "Saves 2 hours/day",
                setupTime: "30 mins",
                steps: [{ title: "Step 1", description: "Do it", demoText: "Like this" }],
            });

        expect(res.status).toBe(201);
        expect(res.body.data.isDraft).toBe(false);
    });

    it("returns 422 when publishing without required publish fields", async () => {
        // isDraft=false triggers superRefine validation — missing `role` causes a field-level error
        const res = await request(app)
            .post("/api/v1/workflows")
            .set("Authorization", authHeader())
            .send({ title: "My Workflow", isDraft: false }); // role, toolStack, etc. missing

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });

    it("returns 422 when title is missing entirely", async () => {
        // Title is the only unconditionally required field on a workflow
        const res = await request(app)
            .post("/api/v1/workflows")
            .set("Authorization", authHeader())
            .send({ isDraft: true });

        expect(res.status).toBe(422);
    });

    it("returns 401 when no token is provided", async () => {
        // Creating a workflow is a protected action — unauthenticated users are blocked
        const res = await request(app)
            .post("/api/v1/workflows")
            .send({ title: "No auth", isDraft: true });

        expect(res.status).toBe(401);
    });
});

// ─── PATCH /api/v1/workflows/:id ─────────────────────────────────────────────
describe("PATCH /api/v1/workflows/:id", () => {
    it("updates a workflow's title when the requester is the author (200)", async () => {
        // The service checks authorId === requesterId before allowing the update
        mockWorkflow.findUnique.mockResolvedValue({ authorId: AUTHOR.id });
        mockWorkflow.update.mockResolvedValue({ ...PUBLISHED_WORKFLOW, title: "Updated" });

        const res = await request(app)
            .patch(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`)
            .set("Authorization", authHeader())
            .send({ title: "Updated" });

        expect(res.status).toBe(200);
        expect(res.body.data.title).toBe("Updated");
    });

    it("returns 403 when a different user tries to update the workflow", async () => {
        // Ownership check: authorId belongs to AUTHOR, but we send a token for 'other user'
        mockWorkflow.findUnique.mockResolvedValue({ authorId: AUTHOR.id });

        const res = await request(app)
            .patch(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`)
            .set("Authorization", otherUserToken())
            .send({ title: "Hijack attempt" });

        expect(res.status).toBe(403);
    });

    it("returns 404 when the workflow does not exist", async () => {
        mockWorkflow.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .patch("/api/v1/workflows/ghost-id")
            .set("Authorization", authHeader())
            .send({ title: "ghost" });

        expect(res.status).toBe(404);
    });

    it("returns 401 when no token is provided", async () => {
        const res = await request(app)
            .patch(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`)
            .send({ title: "No auth" });

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/v1/workflows/:id ────────────────────────────────────────────
describe("DELETE /api/v1/workflows/:id", () => {
    it("deletes a workflow and returns 204 when the requester is the owner", async () => {
        // A successful delete returns no body — 204 No Content
        mockWorkflow.findUnique.mockResolvedValue({ authorId: AUTHOR.id });
        mockWorkflow.delete.mockResolvedValue(PUBLISHED_WORKFLOW);

        const res = await request(app)
            .delete(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`)
            .set("Authorization", authHeader());

        expect(res.status).toBe(204);
    });

    it("returns 403 when a non-owner tries to delete the workflow", async () => {
        mockWorkflow.findUnique.mockResolvedValue({ authorId: AUTHOR.id });

        const res = await request(app)
            .delete(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`)
            .set("Authorization", otherUserToken());

        expect(res.status).toBe(403);
    });

    it("returns 401 when not authenticated", async () => {
        const res = await request(app)
            .delete(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}`);

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/v1/workflows/:id/view ─────────────────────────────────────────
describe("POST /api/v1/workflows/:id/view", () => {
    it("increments the view counter and returns the updated workflow (200)", async () => {
        // Views are public — no auth needed, called automatically on page load
        mockWorkflow.update.mockResolvedValue({ ...PUBLISHED_WORKFLOW, views: 1 });

        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/view`);

        expect(res.status).toBe(200);
        expect(res.body.data.views).toBe(1);
    });

    it("returns 404 when the workflow does not exist (Prisma P2025)", async () => {
        // The service catches Prisma's 'record not found' error and converts it to 404
        mockWorkflow.update.mockRejectedValue({ code: "P2025" });

        const res = await request(app)
            .post("/api/v1/workflows/ghost-id/view");

        expect(res.status).toBe(404);
    });
});

// ─── POST /api/v1/workflows/:id/like ─────────────────────────────────────────
describe("POST /api/v1/workflows/:id/like", () => {
    it("increments likes when authenticated (200)", async () => {
        // Liking requires auth to prevent trivial abuse
        mockWorkflow.update.mockResolvedValue({ ...PUBLISHED_WORKFLOW, likes: 1 });

        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/like`)
            .set("Authorization", authHeader());

        expect(res.status).toBe(200);
        expect(res.body.data.likes).toBe(1);
    });

    it("returns 401 without a token", async () => {
        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/like`);

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/v1/workflows/:id/clone ────────────────────────────────────────
describe("POST /api/v1/workflows/:id/clone", () => {
    it("increments clone count when authenticated (200)", async () => {
        mockWorkflow.update.mockResolvedValue({ ...PUBLISHED_WORKFLOW, clones: 1 });

        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/clone`)
            .set("Authorization", authHeader());

        expect(res.status).toBe(200);
        expect(res.body.data.clones).toBe(1);
    });

    it("returns 401 without a token", async () => {
        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/clone`);

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/v1/workflows/:id/comments ─────────────────────────────────────
describe("POST /api/v1/workflows/:id/comments", () => {
    it("adds a comment when authenticated and content is valid (201)", async () => {
        // Comments are authenticated to know who posted them
        mockWorkflow.findUnique.mockResolvedValue({ id: PUBLISHED_WORKFLOW.id });
        mockComment.create.mockResolvedValue({
            id: "comment-cuid-001",
            content: "Loved this workflow!",
            workflowId: PUBLISHED_WORKFLOW.id,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/comments`)
            .set("Authorization", authHeader())
            .send({ content: "Loved this workflow!" });

        expect(res.status).toBe(201);
        expect(res.body.data.content).toBe("Loved this workflow!");
    });

    it("returns 422 when comment content is empty", async () => {
        // The commentSchema enforces min(1) — an empty string is invalid
        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/comments`)
            .set("Authorization", authHeader())
            .send({ content: "" });

        expect(res.status).toBe(422);
    });

    it("returns 401 without authentication", async () => {
        const res = await request(app)
            .post(`/api/v1/workflows/${PUBLISHED_WORKFLOW.id}/comments`)
            .send({ content: "anonymous" });

        expect(res.status).toBe(401);
    });
});
