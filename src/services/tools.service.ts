import { prisma } from "../config/database.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import type {
    ListToolsQuery,
    CreateToolBody,
    UpdateToolBody,
    ReviewBody,
} from "../schemas/tools.schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Full include shape — used on reads to avoid N+1 queries. */
const TOOL_INCLUDE = {
    reviews: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    alternatives: true,
    pricing: true,
} as const;

function buildPagination(page: number, limit: number) {
    return { take: limit, skip: (page - 1) * limit };
}

function buildMeta(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

/**
 * Recalculates the average rating and rateCount for a tool from scratch
 * and writes the cached values back to the Tools row.
 * Must be called inside a transaction.
 */
async function syncRating(tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">, toolId: number) {
    const agg = await tx.review.aggregate({
        where: { toolId },
        _avg: { rating: true },
        _count: { rating: true },
    });

    await tx.tools.update({
        where: { id: toolId },
        data: {
            rating: agg._avg.rating ?? 0,
            rateCount: agg._count.rating ?? 0,
        },
    });
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listTools({ search, sortBy, order, page, limit }: ListToolsQuery) {
    const where = search
        ? {
            OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
            ],
        }
        : {};

    const [tools, total] = await Promise.all([
        prisma.tools.findMany({
            where,
            orderBy: { [sortBy]: order },
            include: TOOL_INCLUDE,
            ...buildPagination(page, limit),
        }),
        prisma.tools.count({ where }),
    ]);

    return { tools, meta: buildMeta(total, page, limit) };
}

export async function getTool(id: number) {
    const tool = await prisma.tools.findUnique({ where: { id }, include: TOOL_INCLUDE });
    if (!tool) throw new NotFoundError("Tool not found");
    return tool;
}

export async function createTool(body: CreateToolBody) {
    const { alternatives, pricing, uploadedFile, ...fields } = body;

    return prisma.tools.create({
        data: {
            ...fields,
            alternatives: alternatives.length ? { create: alternatives } : undefined,
            pricing: pricing.length ? { create: pricing } : undefined,
            image: uploadedFile?.secure_url || null,
        },
        include: TOOL_INCLUDE,
    });
}

export async function updateTool(id: number, body: UpdateToolBody) {
    // Verify it exists
    const existing = await prisma.tools.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Tool not found");

    const { alternatives, pricing, uploadedFile, ...scalarFields } = body;

    return prisma.$transaction(async (tx) => {
        // Replace nested arrays atomically when provided
        if (alternatives !== undefined) {
            await tx.alternative.deleteMany({ where: { toolId: id } });
        }
        if (pricing !== undefined) {
            await tx.toolPricing.deleteMany({ where: { toolId: id } });
        }

        return tx.tools.update({
            where: { id },
            data: {
                ...scalarFields,
                ...(alternatives ? { alternatives: { create: alternatives } } : {}),
                ...(pricing ? { pricing: { create: pricing } } : {}),
                image: uploadedFile?.secure_url || null,
            },
            include: TOOL_INCLUDE,
        });
    });
}

export async function deleteTool(id: number) {
    const existing = await prisma.tools.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Tool not found");
    await prisma.tools.delete({ where: { id } });
}

export async function addReview(toolId: number, userId: string, body: ReviewBody) {
    // Check tool exists
    const tool = await prisma.tools.findUnique({ where: { id: toolId }, select: { id: true } });
    if (!tool) throw new NotFoundError("Tool not found");

    // Enforce one review per user per tool (mirrors the @@unique constraint)
    const existing = await prisma.review.findUnique({ where: { toolId_userId: { toolId, userId } } });
    if (existing) throw new ConflictError("You have already reviewed this tool");

    return prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
            data: { ...body, toolId, userId },
            include: { user: { select: { id: true, name: true, avatar: true } } },
        });

        // Recompute cached averages
        await syncRating(tx, toolId);

        return review;
    });
}

export async function updateReview(
    toolId: number,
    userId: string,
    body: ReviewBody
) {
    const existing = await prisma.review.findUnique({
        where: { toolId_userId: { toolId, userId } },
        select: { userId: true },
    });
    if (!existing) throw new NotFoundError("Review not found");
    if (existing.userId !== userId) throw new ForbiddenError("You do not own this review");

    return prisma.$transaction(async (tx) => {
        const review = await tx.review.update({
            where: { toolId_userId: { toolId, userId } },
            data: body,
            include: { user: { select: { id: true, name: true, avatar: true } } },
        });
        await syncRating(tx, toolId);
        return review;
    });
}

export async function deleteReview(toolId: number, userId: string) {
    const existing = await prisma.review.findUnique({
        where: { toolId_userId: { toolId, userId } },
        select: { userId: true },
    });
    if (!existing) throw new NotFoundError("Review not found");
    if (existing.userId !== userId) throw new ForbiddenError("You do not own this review");

    await prisma.$transaction(async (tx) => {
        await tx.review.delete({ where: { toolId_userId: { toolId, userId } } });
        await syncRating(tx, toolId);
    });
}
