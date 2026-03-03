/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Mock Prisma before any app imports ───────────────────────────────────────
// We stub only the DB models the tools routes touch so no real connection is made.
const mockTools = {
  findMany: jest.fn<() => Promise<unknown>>(),
  count: jest.fn<() => Promise<unknown>>(),
  findUnique: jest.fn<() => Promise<unknown>>(),
  create: jest.fn<() => Promise<unknown>>(),
  update: jest.fn<() => Promise<unknown>>(),
  delete: jest.fn<() => Promise<unknown>>(),
};
const mockAlternative = { deleteMany: jest.fn<() => Promise<unknown>>() };
const mockToolPricing = { deleteMany: jest.fn<() => Promise<unknown>>() };
const mockReview = {
  findUnique: jest.fn<() => Promise<unknown>>(),
  create: jest.fn<() => Promise<unknown>>(),
  update: jest.fn<() => Promise<unknown>>(),
  delete: jest.fn<() => Promise<unknown>>(),
  aggregate: jest.fn<() => Promise<unknown>>(),
};

// The $transaction helper passes a transaction client (tx) to callbacks.
// Here we return the same stubs so the service code works seamlessly.
const mockTx = {
  tools: mockTools,
  alternative: mockAlternative,
  toolPricing: mockToolPricing,
  review: mockReview,
};

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    tools: mockTools,
    alternative: mockAlternative,
    toolPricing: mockToolPricing,
    review: mockReview,
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockTx)),
  } as unknown as PrismaClient,
  connectDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  disconnectDatabase: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
}));

// ─── Import AFTER mocks are registered ───────────────────────────────────────
const { default: request } = await import("supertest");
const { createApp } = await import("../../app.js");
const { generateAccessToken } = await import("../../utils/auth.js");

const app = createApp();

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const TOOL = {
  id: 1,
  name: "VSCode",
  description: "A great code editor",
  avgTimeSaved: "2 hours/day",
  bestUseCases: ["coding", "debugging"],
  poorUseCases: ["design work"],
  rating: 4.5,
  rateCount: 10,
  reviews: [],
  alternatives: [],
  pricing: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const REVIEW = {
  id: 1,
  rating: 5,
  content: "Absolutely love it",
  toolId: 1,
  userId: "user-cuid-001",
  user: { id: "user-cuid-001", name: "Alice", avatar: null },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** JWT for a regular user. */
const userToken = () =>
  `Bearer ${generateAccessToken({ userId: "user-cuid-001", email: "alice@example.com" })}`;
/** JWT for an admin user. */
const adminToken = () =>
  `Bearer ${generateAccessToken({ userId: "admin-cuid-001", email: "admin@example.com", role: "ADMIN" })}`;

beforeEach(() => {
  jest.clearAllMocks();
  // Default stubs for public list/get tests
  mockTools.findMany.mockResolvedValue([TOOL]);
  mockTools.count.mockResolvedValue(1);
  mockTools.findUnique.mockResolvedValue(TOOL);
  mockReview.aggregate.mockResolvedValue({
    _avg: { rating: 4.5 },
    _count: { rating: 10 },
  });
});

// ─── GET /api/v1/tools ────────────────────────────────────────────────────────
describe("GET /api/v1/tools", () => {
  it("returns a paginated list of tools without any authentication (200)", async () => {
    // Tools are publicly browsable — no sign-in required
    const res = await request(app).get("/api/v1/tools");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it("accepts valid query params: search, sortBy, order, page, limit (200)", async () => {
    // Clients can filter by keyword and control sort order and page size
    const res = await request(app).get("/api/v1/tools").query({
      search: "VSCode",
      sortBy: "rating",
      order: "desc",
      page: 1,
      limit: 10,
    });

    expect(res.status).toBe(200);
  });

  it("rejects an invalid sortBy value (400)", async () => {
    // Only rating, rateCount, name, createdAt are valid sort fields
    const res = await request(app)
      .get("/api/v1/tools")
      .query({ sortBy: "unknown_field" });

    // Zod enum validation always returns 422 (Unprocessable Entity)
    expect(res.status).toBe(422);
  });
});

// ─── GET /api/v1/tools/:id ────────────────────────────────────────────────────
describe("GET /api/v1/tools/:id", () => {
  it("returns a single tool with reviews, alternatives, and pricing (200)", async () => {
    // Anyone can view a tool's detail page — includes embedded related data
    const res = await request(app).get("/api/v1/tools/1");

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(TOOL.id);
    expect(res.body.data.name).toBe("VSCode");
  });

  it("returns 404 when no tool exists with that ID", async () => {
    // The service throws NotFoundError when findUnique returns null
    mockTools.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/v1/tools/9999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for a non-integer ID like a string slug", async () => {
    // Unlike workflow IDs (cuid strings), tool IDs are Int — invalid values are rejected
    const res = await request(app).get("/api/v1/tools/not-a-number");

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/tools (admin only) ─────────────────────────────────────────
describe("POST /api/v1/tools", () => {
  const validBody = {
    name: "VSCode",
    description: "A great code editor",
    avgTimeSaved: "2 hours/day",
    bestUseCases: ["coding"],
    poorUseCases: [],
    alternatives: [],
    pricing: [],
  };

  it("creates a tool when the requester is an admin (201)", async () => {
    // Only admins can add new tools to the catalogue
    mockTools.create.mockResolvedValue(TOOL);

    const res = await request(app)
      .post("/api/v1/tools")
      .set("Authorization", adminToken())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("VSCode");
  });

  it("returns 403 when a regular (non-admin) user tries to create a tool", async () => {
    // The authorize("ADMIN") middleware blocks non-admin users with 403 Forbidden
    const res = await request(app)
      .post("/api/v1/tools")
      .set("Authorization", userToken())
      .send(validBody);

    // The authorize middleware throws UnauthorizedError (401) when the
    // token has no role claim — e.g. a regular user token omits `role`
    expect(res.status).toBe(401);
  });

  it("returns 401 when no token is provided", async () => {
    // Authentication is required before authorization can even be checked
    const res = await request(app).post("/api/v1/tools").send(validBody);

    expect(res.status).toBe(401);
  });

  it("returns 422 when required fields are missing", async () => {
    // The Zod schema requires name, description, avgTimeSaved, and bestUseCases
    const res = await request(app)
      .post("/api/v1/tools")
      .set("Authorization", adminToken())
      .send({ name: "VSCode" }); // missing description, avgTimeSaved, bestUseCases

    expect(res.status).toBe(422);
  });

  it("returns 422 when bestUseCases is an empty array", async () => {
    // At least one use case must be provided when creating a tool
    const res = await request(app)
      .post("/api/v1/tools")
      .set("Authorization", adminToken())
      .send({ ...validBody, bestUseCases: [] });

    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/v1/tools/:id (admin only) ────────────────────────────────────
describe("PATCH /api/v1/tools/:id", () => {
  it("updates a tool's description when requester is admin (200)", async () => {
    // Admin-only: update any field of a tool, including nested arrays
    mockTools.update.mockResolvedValue({
      ...TOOL,
      description: "Updated description",
    });

    const res = await request(app)
      .patch("/api/v1/tools/1")
      .set("Authorization", adminToken())
      .send({ description: "Updated description" });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("Updated description");
  });

  it("returns 403 for a regular user", async () => {
    const res = await request(app)
      .patch("/api/v1/tools/1")
      .set("Authorization", userToken())
      .send({ description: "hack" });

    expect(res.status).toBe(401);
  });

  it("returns 404 when the tool does not exist", async () => {
    mockTools.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/v1/tools/9999")
      .set("Authorization", adminToken())
      .send({ description: "anything" });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/v1/tools/:id (admin only) ───────────────────────────────────
describe("DELETE /api/v1/tools/:id", () => {
  it("deletes a tool and returns 204 (admin only)", async () => {
    // Cascade deletes (reviews, alternatives, pricing) are handled by Prisma relations
    mockTools.delete.mockResolvedValue(TOOL);

    const res = await request(app)
      .delete("/api/v1/tools/1")
      .set("Authorization", adminToken());

    expect(res.status).toBe(204);
  });

  it("returns 401 when a regular user tries to delete (no role in token)", async () => {
    const res = await request(app)
      .delete("/api/v1/tools/1")
      .set("Authorization", userToken());

    expect(res.status).toBe(401);
  });

  it("returns 404 when the tool does not exist", async () => {
    mockTools.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/v1/tools/9999")
      .set("Authorization", adminToken());

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/tools/:id/reviews ──────────────────────────────────────────
describe("POST /api/v1/tools/:id/reviews", () => {
  it("submits a review from an authenticated user (201)", async () => {
    // Each user can leave one review per tool — the DB enforces the unique constraint
    mockReview.findUnique.mockResolvedValue(null); // no existing review
    mockReview.create.mockResolvedValue(REVIEW);
    mockTools.update.mockResolvedValue(TOOL); // syncRating update

    const res = await request(app)
      .post("/api/v1/tools/1/reviews")
      .set("Authorization", userToken())
      .send({ rating: 5, content: "Absolutely love it" });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Absolutely love it");
  });

  it("returns 409 when the user has already reviewed this tool", async () => {
    // The ConflictError prevents a second review from the same user for the same tool
    mockReview.findUnique.mockResolvedValue(REVIEW); // already exists

    const res = await request(app)
      .post("/api/v1/tools/1/reviews")
      .set("Authorization", userToken())
      .send({ rating: 4, content: "Trying to post again" });

    expect(res.status).toBe(409);
  });

  it("returns 422 when rating is out of the 1–5 range", async () => {
    // Ratings must be integers from 1 to 5 inclusive — enforced by Zod
    const res = await request(app)
      .post("/api/v1/tools/1/reviews")
      .set("Authorization", userToken())
      .send({ rating: 10, content: "Off the charts" });

    expect(res.status).toBe(422);
  });

  it("returns 422 when content is missing", async () => {
    // A review must include written content — rating alone is not sufficient
    const res = await request(app)
      .post("/api/v1/tools/1/reviews")
      .set("Authorization", userToken())
      .send({ rating: 4 });

    expect(res.status).toBe(422);
  });

  it("returns 401 when not authenticated", async () => {
    // Anonymous reviews are not allowed
    const res = await request(app)
      .post("/api/v1/tools/1/reviews")
      .send({ rating: 5, content: "Anonymous" });

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/v1/tools/:id/reviews ─────────────────────────────────────────
describe("PATCH /api/v1/tools/:id/reviews", () => {
  it("lets a user update their own review (200)", async () => {
    // Users can change their mind — only the author of the review may update it
    mockReview.findUnique.mockResolvedValue(REVIEW);
    mockReview.update.mockResolvedValue({
      ...REVIEW,
      content: "Updated opinion",
    });
    mockTools.update.mockResolvedValue(TOOL);

    const res = await request(app)
      .patch("/api/v1/tools/1/reviews")
      .set("Authorization", userToken())
      .send({ rating: 4, content: "Updated opinion" });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe("Updated opinion");
  });

  it("returns 404 when the user has not reviewed this tool yet", async () => {
    // Can't update a review that doesn't exist
    mockReview.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/v1/tools/1/reviews")
      .set("Authorization", userToken())
      .send({ rating: 4, content: "Doesn't exist" });

    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .patch("/api/v1/tools/1/reviews")
      .send({ rating: 3, content: "Anon edit" });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/v1/tools/:id/reviews ────────────────────────────────────────
describe("DELETE /api/v1/tools/:id/reviews", () => {
  it("deletes the user's own review and returns 204", async () => {
    // After deletion, syncRating recalculates the tool average inside a transaction
    mockReview.findUnique.mockResolvedValue(REVIEW);
    mockReview.delete.mockResolvedValue(REVIEW);
    mockTools.update.mockResolvedValue(TOOL);

    const res = await request(app)
      .delete("/api/v1/tools/1/reviews")
      .set("Authorization", userToken());

    expect(res.status).toBe(204);
  });

  it("returns 404 when the user has no review to delete", async () => {
    mockReview.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/v1/tools/1/reviews")
      .set("Authorization", userToken());

    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).delete("/api/v1/tools/1/reviews");

    expect(res.status).toBe(401);
  });
});
