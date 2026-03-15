import type { NextFunction, Request, Response } from "express";
import { successResponse } from "../utils/apiResponse.js";
import {
  BadRequestError,
  UnauthorizedError,
  ValidationError,
} from "../utils/errors.js";
import {
  listToolsQuerySchema,
  createToolSchema,
  updateToolSchema,
  reviewSchema,
  getToolByNameSchema,
} from "../schemas/tools.schema.js";
import * as ToolService from "../services/tools.service.js";
import { deleteFromCloudinary } from "../middleware/upload.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOrThrow<T>(
  schema: {
    safeParse: (d: unknown) => {
      success: boolean;
      data?: T;
      error?: { flatten: () => { fieldErrors: Record<string, string[]> } };
    };
  },
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "Validation failed",
      result.error!.flatten().fieldErrors,
    );
  }
  return result.data!;
}

function requireUserId(req: Request): string {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError("Authentication required");
  return userId;
}

function parseToolId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    throw new BadRequestError("Invalid tool id");
  return id;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /tools
 * List all tools with optional search and sort.
 * Public.
 */
export async function get_tools(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = parseOrThrow(listToolsQuerySchema, req.query);
    const { tools, meta } = await ToolService.listTools(query);
    return successResponse(res, "Tools fetched successfully", tools, 200, meta);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /tools/name
 * List all tools name only
 * Public.
 */
export async function getToolsNamesOnly(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tools = await ToolService.getToolsName();

    return successResponse(res, "Tools names fetched successfully", tools, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tools/:id
 * Fetch a single tool with its reviews, alternatives, and pricing.
 * Public.
 */
export async function get_tool(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseToolId(req);
    const tool = await ToolService.getTool(id);
    return successResponse(res, "Tool fetched successfully", tool);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /tools/:name
 * Fetch a single tool with its image only using the tool name.
 * Public.
 */
export async function get_tool_by_name(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const name = parseOrThrow(getToolByNameSchema, req.query);
    const tool = await ToolService.getToolByName(name.name);
    return successResponse(res, "Tool fetched successfully", tool);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /tools
 * Create a new tool.
 * Protected — admin only.
 */
export async function create_tool(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (typeof req.body.bestUseCases === "string") {
      req.body.bestUseCases = JSON.parse(req.body.bestUseCases);
    }

    if (typeof req.body.poorUseCases === "string") {
      req.body.poorUseCases = JSON.parse(req.body.poorUseCases);
    }

    if (typeof req.body.alternatives === "string") {
      req.body.alternatives = JSON.parse(req.body.alternatives);
    }

    if (typeof req.body.roles === "string") {
      req.body.roles = JSON.parse(req.body.roles);
    }

    if (typeof req.body.tasks === "string") {
      req.body.tasks = JSON.parse(req.body.tasks);
    }

    if (typeof req.body.pricing === "string") {
      req.body.pricing = JSON.parse(req.body.pricing);
    }

    const body = parseOrThrow(createToolSchema, req.body);
    const tool = await ToolService.createTool(body);
    return successResponse(res, "Tool created successfully", tool, 201);
  } catch (error) {
    if (req.body.uploadedFile?.public_id) {
      // Use the delete function you already wrote!
      await deleteFromCloudinary(req.body.uploadedFile.public_id).catch((e) =>
        console.error("Failed to delete orphaned file:", e),
      );
    }
    return next(error);
  }
}

/**
 * PATCH /tools/:id
 * Update a tool's fields, alternatives, or pricing.
 * Protected — admin only.
 */
export async function update_tool(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (typeof req.body.bestUseCases === "string") {
      req.body.bestUseCases = JSON.parse(req.body.bestUseCases);
    }

    if (typeof req.body.roles === "string") {
      req.body.roles = JSON.parse(req.body.roles);
    }

    if (typeof req.body.tasks === "string") {
      req.body.tasks = JSON.parse(req.body.tasks);
    }

    if (typeof req.body.poorUseCases === "string") {
      req.body.poorUseCases = JSON.parse(req.body.poorUseCases);
    }

    if (typeof req.body.alternatives === "string") {
      req.body.alternatives = JSON.parse(req.body.alternatives);
    }

    if (typeof req.body.pricing === "string") {
      req.body.pricing = JSON.parse(req.body.pricing);
    }

    const id = parseToolId(req);
    const body = parseOrThrow(updateToolSchema, req.body);
    const tool = await ToolService.updateTool(id, body);
    return successResponse(res, "Tool updated successfully", tool);
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /tools/:id
 * Delete a tool and all its related data.
 * Protected — admin only.
 */
export async function delete_tool(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseToolId(req);
    await ToolService.deleteTool(id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /tools/:id/reviews
 * Submit a review for a tool.
 * Protected — one review per user per tool (enforced at DB level).
 */
export async function add_review(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = requireUserId(req);
    const id = parseToolId(req);
    const body = parseOrThrow(reviewSchema, req.body);
    const review = await ToolService.addReview(id, userId, body);
    return successResponse(res, "Review submitted", review, 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /tools/:id/reviews
 * Update your own review.
 * Protected — must be the review's author.
 */
export async function update_review(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = requireUserId(req);
    const id = parseToolId(req);
    const body = parseOrThrow(reviewSchema, req.body);
    const review = await ToolService.updateReview(id, userId, body);
    return successResponse(res, "Review updated", review);
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /tools/:id/reviews
 * Delete your own review.
 * Protected — must be the review's author.
 */
export async function delete_review(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = requireUserId(req);
    const id = parseToolId(req);
    await ToolService.deleteReview(id, userId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
