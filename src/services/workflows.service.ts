import { prisma } from "../config/database.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import type {
    ListWorkflowsQuery,
    SearchWorkflowsQuery,
    CreateWorkflowBody,
    UpdateWorkflowBody,
    CommentBody,
} from "../schemas/workflows.schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_BY_MAP = {
    trending: { views: "desc" },
    "top-rated": { likes: "desc" },
    newest: { createdAt: "desc" },
} as const;

function buildPagination(page: number, limit: number) {
    return { take: limit, skip: (page - 1) * limit };
}

function buildMeta(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}

// ─── Workflow include config ───────────────────────────────────────────────────
// Select only the author's public fields so we don't leak password hashes.
const WORKFLOW_INCLUDE = {
    author: { select: { id: true, name: true, avatar: true } },
    steps: true,
} as const;

// ─── Service functions ────────────────────────────────────────────────────────

export async function listWorkflows({ orderBy, page, limit }: ListWorkflowsQuery) {
    const [workflows, total] = await Promise.all([
        prisma.workflow.findMany({
            where: { isDraft: false },
            orderBy: ORDER_BY_MAP[orderBy],
            include: WORKFLOW_INCLUDE,
            ...buildPagination(page, limit),
        }),
        prisma.workflow.count({ where: { isDraft: false } }),
    ]);

    return { workflows, meta: buildMeta(total, page, limit) };
}

export async function searchWorkflows({
    orderBy,
    page,
    limit,
    title,
    role,
    category,
    toolStack,
}: SearchWorkflowsQuery) {
    const where: Record<string, unknown> = { isDraft: false };

    if (title) where.title = { contains: title, mode: "insensitive" };
    if (role) where.role = { contains: role, mode: "insensitive" };
    if (category) where.category = category;
    if (toolStack) {
        where.toolStack = {
            hasSome: Array.isArray(toolStack) ? toolStack : [toolStack],
        };
    }

    const [workflows, total] = await Promise.all([
        prisma.workflow.findMany({
            where,
            orderBy: ORDER_BY_MAP[orderBy],
            include: WORKFLOW_INCLUDE,
            ...buildPagination(page, limit),
        }),
        prisma.workflow.count({ where }),
    ]);

    return { workflows, meta: buildMeta(total, page, limit) };
}

export async function getWorkflow(id: string) {
    const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: WORKFLOW_INCLUDE,
    });
    if (!workflow) throw new NotFoundError("Workflow not found");
    return workflow;
}

export async function createWorkflow(body: CreateWorkflowBody, authorId: string) {
    // 1. Pull out EVERYTHING that isn't a direct column on the Workflow table
    const { steps, uploadedFile, ...scalarFields } = body;

    // 2. Create the Workflow and its related tables in one single shot
    return prisma.workflow.create({
        data: {
            ...scalarFields,
            role: scalarFields.role ?? "",
            toolStack: scalarFields.toolStack ?? [],
            insight: scalarFields.insight ?? "",
            description: scalarFields.description ?? "",
            setupTime: scalarFields.setupTime ?? "",
            authorId, // Link to the user who created it

            // Nested write for Steps
            steps: steps?.length ? { create: steps } : undefined,

            // Nested write for the WorkflowResult (The 1-to-1 relation)
            // If uploadedFile exists, we tell Prisma to `create` the result right now
            ...(uploadedFile ? {
                result: {
                    create: {
                        // Assuming your data is on uploadedFile like in the update function
                        url: uploadedFile.secure_url,
                        width: uploadedFile.width,
                        height: uploadedFile.height,
                        format: uploadedFile.format,
                    }
                }
            } : {})
        },
        include: WORKFLOW_INCLUDE, // Assuming you defined this elsewhere
    });
}

export async function updateWorkflow(
    id: string,
    body: UpdateWorkflowBody,
    requesterId: string
) {
    const existing = await prisma.workflow.findUnique({ where: { id }, select: { authorId: true } });
    if (!existing) throw new NotFoundError("Workflow not found");
    if (existing.authorId !== requesterId) throw new ForbiddenError("You do not own this workflow");

    const { steps, uploadedFile, result, ...scalarFields } = body;

    return prisma.$transaction(async (tx) => {
        if (steps !== undefined) {
            await tx.step.deleteMany({ where: { workflowId: id } });
        }

        if (uploadedFile) {
            await tx.workflowResult.upsert({
                where: { workflowId: id },
                create: {
                    url: uploadedFile.secure_url,
                    width: uploadedFile.width,
                    height: uploadedFile.height,
                    format: uploadedFile.format,
                    workflowId: id,
                },
                update: {
                    url: uploadedFile.secure_url,
                    width: uploadedFile.width,
                    height: uploadedFile.height,
                    format: uploadedFile.format,
                }
            });
        }

        return tx.workflow.update({
            where: { id },
            data: {
                ...scalarFields,
                ...(steps ? { steps: { create: steps } } : {}),
            },
        });
    });
}

export async function deleteWorkflow(id: string, requesterId: string) {
    const existing = await prisma.workflow.findUnique({ where: { id }, select: { authorId: true } });
    if (!existing) throw new NotFoundError("Workflow not found");
    if (existing.authorId !== requesterId) throw new ForbiddenError("You do not own this workflow");

    await prisma.workflow.delete({ where: { id } });
}

type CounterField = "likes" | "views" | "clones";

export async function incrementCounter(id: string, field: CounterField) {
    // Using updateOrThrow pattern — P2025 will be thrown if record doesn't exist
    try {
        return await prisma.workflow.update({
            where: { id },
            data: { [field]: { increment: 1 } },
        });
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code: string }).code === "P2025"
        ) {
            throw new NotFoundError("Workflow not found");
        }
        throw error;
    }
}

export async function createComment(workflowId: string, body: CommentBody) {
    // Verify workflow exists first
    const exists = await prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { id: true },
    });
    if (!exists) throw new NotFoundError("Workflow not found");

    return prisma.comment.create({
        data: {
            content: body.content,
            workflow: { connect: { id: workflowId } },
        },
    });
}
