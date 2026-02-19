import type { Response } from "express";

interface ApiResponseOptions<T> {
    res: Response;
    statusCode: number;
    success: boolean;
    message: string;
    data?: T;
    meta?: Record<string, unknown>;
}

export function apiResponse<T>({
    res,
    statusCode,
    success,
    message,
    data,
    meta,
}: ApiResponseOptions<T>): void {
    res.status(statusCode).json({
        success,
        message,
        data: data ?? null,
        meta: meta ?? null,
    });
}

export function successResponse<T>(
    res: Response,
    message: string,
    data?: T,
    statusCode: number = 200,
    meta?: Record<string, unknown>
): void {
    apiResponse({ res, statusCode, success: true, message, data, meta });
}

export function errorResponse(
    res: Response,
    message: string,
    statusCode: number = 500,
    data?: unknown
): void {
    apiResponse({ res, statusCode, success: false, message, data });
}
