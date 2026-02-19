import type { Request, Response, NextFunction } from "express";
import aj from "../config/arcjet.js";
import { TooManyRequestsError, ForbiddenError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Arcjet protection middleware — applies rate limiting,
 * bot detection, and shield (attack prevention).
 */
export async function arcjetProtection(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const decision = await aj.protect(req, { requested: 1 });

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
                logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
                throw new TooManyRequestsError(
                    "Too many requests. Please try again later."
                );
            }

            if (decision.reason.isBot()) {
                logger.warn(`Bot detected from IP: ${req.ip}`);
                throw new ForbiddenError("Automated access is not allowed.");
            }

            logger.warn(
                `Request denied by Arcjet for IP: ${req.ip} — reason: ${decision.reason}`
            );
            throw new ForbiddenError("Request denied.");
        }

        next();
    } catch (error) {
        next(error);
    }
}
