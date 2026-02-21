import type { NextFunction, Request, Response } from "express";
import { successResponse } from "../utils/apiResponse.js";
import { BadRequestError, UnauthorizedError, ValidationError } from "../utils/errors.js";
import {
    listWorkflowsQuerySchema,
    searchWorkflowsQuerySchema,
    createWorkflowSchema,
    updateWorkflowSchema,
    commentSchema,
} from "../schemas/workflows.schema.js";
import * as WorkflowService from "../services/workflows.service.js";
import { deleteFromCloudinary } from "../middleware/upload.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses and validates data against a Zod schema.
 * Throws a ValidationError (422) with field-level messages on failure.
 */
function parseOrThrow<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { flatten: () => { fieldErrors: Record<string, string[]> } } } }, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        const fieldErrors = result.error!.flatten().fieldErrors;
        throw new ValidationError("Validation failed", fieldErrors);
    }
    return result.data!;
}

/** Returns the authenticated user's ID or throws 401. */
function requireUserId(req: Request): string {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedError("Authentication required");
    return userId;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /workflows
 * List published workflows with sorting and pagination.
 * Public — no auth required.
 */
export async function get_workflows(req: Request, res: Response, next: NextFunction) {
    try {
        const query = parseOrThrow(listWorkflowsQuerySchema, req.query);
        const { workflows, meta } = await WorkflowService.listWorkflows(query);
        successResponse(res, "Workflows fetched successfully", workflows, 200, meta);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /workflows/search
 * Search published workflows by title, role, category, or toolStack.
 * Public — no auth required.
 */
export async function get_workflow_by(req: Request, res: Response, next: NextFunction) {
    try {
        const query = parseOrThrow(searchWorkflowsQuerySchema, req.query);

        const hasFilter = query.title || query.role || query.category || query.toolStack;
        if (!hasFilter) {
            throw new BadRequestError("At least one filter (title, role, category, toolStack) is required");
        }

        const { workflows, meta } = await WorkflowService.searchWorkflows(query);
        successResponse(res, "Workflows fetched successfully", workflows, 200, meta);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /workflows/:id
 * Fetch a single workflow by ID.
 * Public — no auth required.
 */
export async function get_workflow_by_id(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as { id: string };
        const workflow = await WorkflowService.getWorkflow(id);
        successResponse(res, "Workflow fetched successfully", workflow);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /workflows
 * Create a new workflow.
 * Protected — requires authentication.
 * authorId is taken from the JWT (req.user), NOT from the request body.
 */
export async function create_workflow(req: Request, res: Response, next: NextFunction) {
    try {
        const authorId = requireUserId(req);

        // --- FIX 1: Parse ALL complex form-data fields ---
        // Parse steps array
        if (typeof req.body.steps === "string") {
            req.body.steps = JSON.parse(req.body.steps);
        }

        // Parse toolStack array (if you are sending it as a stringified array)
        if (typeof req.body.toolStack === "string") {
            req.body.toolStack = JSON.parse(req.body.toolStack);
        }

        // Parse booleans
        if (typeof req.body.isDraft === "string") {
            req.body.isDraft = req.body.isDraft === "true";
        }

        const body = parseOrThrow(createWorkflowSchema, req.body);
        const workflow = await WorkflowService.createWorkflow(body, authorId);

        return successResponse(res, "Workflow created successfully", workflow, 201);

    } catch (error) {
        // Cleanup Cloudinary if the database transaction fails!
        if (req.body.uploadedFile?.public_id) {
            console.log("Database failed, rolling back Cloudinary upload...");
            // Use the delete function you already wrote!
            await deleteFromCloudinary(req.body.uploadedFile.public_id).catch(e =>
                console.error("Failed to delete orphaned file:", e)
            );
        }
        return next(error);
    }
}

/**
 * PATCH /workflows/:id
 * Update a workflow's fields and/or steps.
 * Protected — must be the workflow's author.
 * Providing `steps` replaces all existing steps atomically.
 */
export async function update_workflow(req: Request, res: Response, next: NextFunction) {
    try {
        const requesterId = requireUserId(req);
        const { id } = req.params as { id: string };

        // 1. FIX: Parse the stringified steps array from Postman/Frontend 
        // BEFORE Zod looks at it
        if (req.body.steps && typeof req.body.steps === "string") {
            try {
                req.body.steps = JSON.parse(req.body.steps);
            } catch (e) {
                // If it fails to parse, stop the request and send a 400 error
                return res.status(400).json({ error: "Invalid JSON format for steps." });
            }
        }

        // 2. Now Zod validates the clean array
        const body = parseOrThrow(updateWorkflowSchema, req.body);
        const workflow = await WorkflowService.updateWorkflow(id, body, requesterId);
        return successResponse(res, "Workflow updated successfully", workflow);
    } catch (error) {
        return next(error);
    }
}

/**
 * DELETE /workflows/:id
 * Permanently delete a workflow and its steps.
 * Protected — must be the workflow's author.
 */
export async function delete_workflow(req: Request, res: Response, next: NextFunction) {
    try {
        const requesterId = requireUserId(req);
        const { id } = req.params as { id: string };
        await WorkflowService.deleteWorkflow(id, requesterId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
}

/**
 * POST /workflows/:id/like
 * Increment a workflow's like count.
 * Protected — requires authentication (prevents anonymous abuse).
 */
export async function update_workflow_likes(req: Request, res: Response, next: NextFunction) {
    try {
        requireUserId(req);
        const { id } = req.params as { id: string };
        const workflow = await WorkflowService.incrementCounter(id, "likes");
        successResponse(res, "Workflow liked", workflow);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /workflows/:id/view
 * Increment a workflow's view count.
 * Public — called automatically by the client on page load.
 */
export async function update_workflow_views(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as { id: string };
        const workflow = await WorkflowService.incrementCounter(id, "views");
        successResponse(res, "View recorded", workflow);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /workflows/:id/clone
 * Increment a workflow's clone count.
 * Protected — requires authentication.
 */
export async function update_workflow_clones(req: Request, res: Response, next: NextFunction) {
    try {
        requireUserId(req);
        const { id } = req.params as { id: string };
        const workflow = await WorkflowService.incrementCounter(id, "clones");
        successResponse(res, "Workflow cloned", workflow);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /workflows/:id/comments
 * Add a comment to a workflow.
 * Protected — requires authentication.
 */
export async function create_workflow_comment(req: Request, res: Response, next: NextFunction) {
    try {
        requireUserId(req);
        const { id } = req.params as { id: string };
        const body = parseOrThrow(commentSchema, req.body);
        const comment = await WorkflowService.createComment(id, body);
        successResponse(res, "Comment created", comment, 201);
    } catch (error) {
        next(error);
    }
}