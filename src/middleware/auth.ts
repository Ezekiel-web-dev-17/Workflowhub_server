import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/auth.js";
import { UnauthorizedError } from "../utils/errors.js";
import type { TokenPayload } from "../utils/auth.js";
import { logger } from "../utils/logger.js";

// Extend Express Request to include user information
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

/**
 * Authentication middleware — verifies the JWT access token
 * from the Authorization header (Bearer <token>).
 */
export function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            throw new UnauthorizedError("No token provided");
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            throw new UnauthorizedError("No token provided");
        }

        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            next(error);
        } else {
            next(new UnauthorizedError("Invalid or expired token"));
        }
    }
}

/**
 * Authorization middleware — checks if the user has one of the allowed roles.
 */
export function authorize(...allowedRoles: string[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError("Authentication required"));
        }

        if (!req.user.role || !allowedRoles.includes(req.user.role)) {
            return next(
                new UnauthorizedError(
                    "You do not have permission to perform this action"
                )
            );
        }

        next();
    };
}
