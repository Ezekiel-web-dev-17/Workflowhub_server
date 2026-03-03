import type { Request, Response } from "express";
import { successResponse } from "../utils/apiResponse.js";

export function healthCheck(_req: Request, res: Response): void {
  successResponse(res, "WorkflowHub API is running", {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env["NODE_ENV"] ?? "development",
  });
}
