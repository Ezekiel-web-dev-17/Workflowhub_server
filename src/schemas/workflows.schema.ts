import { z } from "zod";

// ─── Reusable fragments ───────────────────────────────────────────────────────

const orderByValues = ["trending", "top-rated", "newest"] as const;
const categoryValues = ["marketing", "engineering", "operations", "research", "creative"] as const;

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(6),
});

const orderBySchema = z.enum(orderByValues).default("newest");

// ─── Query schemas ────────────────────────────────────────────────────────────

export const listWorkflowsQuerySchema = paginationSchema.extend({
    orderBy: orderBySchema,
});

export const searchWorkflowsQuerySchema = paginationSchema.extend({
    orderBy: orderBySchema,
    title: z.string().optional(),
    role: z.string().optional(),
    category: z.enum(categoryValues).optional(),
    toolStack: z.union([z.string(), z.array(z.string())]).optional(),
});

// ─── Body schemas ─────────────────────────────────────────────────────────────

const stepSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    demoText: z.string().optional(),
});

/** Fields required only when publishing (isDraft = false). */
const publishFields = z.object({
    role: z.string().min(1),
    toolStack: z.array(z.string()).min(1),
    insight: z.string().min(1),
    description: z.string().min(1),
    setupTime: z.string().min(1),
    steps: z.array(stepSchema).min(1),
    uploadedFile: z.object({
        public_id: z.string(),
        secure_url: z.string(),
        width: z.number(),
        height: z.number(),
        format: z.string(),
    }).optional(),
});

export const createWorkflowSchema = z
    .object({
        title: z.string().min(1, "Title is required"),
        isDraft: z.boolean().default(true),
    })
    .and(publishFields.partial())
    .superRefine((data, ctx) => {
        if (!data.isDraft) {
            const required = ["role", "toolStack", "insight", "description", "setupTime", "uploadedFile", "steps"] as const;
            for (const field of required) {
                if (!data[field] || (Array.isArray(data[field]) && (data[field] as unknown[]).length === 0)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [field],
                        message: `${field} is required when publishing`,
                    });
                }
            }
        }
    });

export const updateWorkflowSchema = z.object({
    title: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    toolStack: z.array(z.string()).optional(),
    insight: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    setupTime: z.string().min(1).optional(),
    result: z.object({
        url: z.string().url(),
        width: z.number(),
        height: z.number(),
        format: z.string(),
    }).optional(),
    isDraft: z.boolean().optional(),
    steps: z.array(stepSchema).optional(),
    uploadedFile: z.object({
        public_id: z.string(),
        secure_url: z.string(),
        width: z.number(),
        height: z.number(),
        format: z.string(),
    }).optional(),
});

export const commentSchema = z.object({
    content: z.string().min(1, "Comment content cannot be empty").max(2000),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ListWorkflowsQuery = z.infer<typeof listWorkflowsQuerySchema>;
export type SearchWorkflowsQuery = z.infer<typeof searchWorkflowsQuerySchema>;
export type CreateWorkflowBody = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowBody = z.infer<typeof updateWorkflowSchema>;
export type CommentBody = z.infer<typeof commentSchema>;
