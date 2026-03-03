import { z } from "zod";

// ─── Reusable ─────────────────────────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(6),
});

// ─── Query schemas ────────────────────────────────────────────────────────────

export const listToolsQuerySchema = paginationSchema.extend({
  search: z.string().optional(), // full-text search on name/description
  sortBy: z
    .enum(["rating", "rateCount", "name", "createdAt"])
    .default("rating"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Body schemas ─────────────────────────────────────────────────────────────

const alternativeSchema = z.object({
  name: z.string().min(1),
  useIf: z.string().min(1).max(200),
});

const pricingSchema = z.object({
  pricingTitle: z.string().min(1),
  price: z.number().min(0),
  per: z.string().min(1), // "month", "year", "seat", "free"
});

export const createToolSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  avgTimeSaved: z.string().min(1),
  bestUseCases: z.array(z.string().min(1)).min(1),
  poorUseCases: z.array(z.string().min(1)).default([]),
  alternatives: z.array(alternativeSchema).default([]),
  pricing: z.array(pricingSchema).default([]),
  uploadedFile: z
    .object({
      public_id: z.string(),
      secure_url: z.string(),
      width: z.number(),
      height: z.number(),
      format: z.string(),
    })
    .optional(),
});

export const updateToolSchema = createToolSchema.partial();

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  content: z.string().min(1, "Review content is required").max(2000),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ListToolsQuery = z.infer<typeof listToolsQuerySchema>;
export type CreateToolBody = z.infer<typeof createToolSchema>;
export type UpdateToolBody = z.infer<typeof updateToolSchema>;
export type ReviewBody = z.infer<typeof reviewSchema>;
