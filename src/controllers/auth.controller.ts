import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import {
    hashPassword,
    comparePassword,
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "../utils/auth.js";
import { successResponse } from "../utils/apiResponse.js";
import {
    ConflictError,
    UnauthorizedError,
    NotFoundError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/auth/register
 */
export async function register(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { name, email, password } = req.body as {
            name: string;
            email: string;
            password: string;
        };

        // Check for existing user
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new ConflictError("A user with this email already exists");
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
        });

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
        });
        const refreshToken = generateRefreshToken({
            userId: user.id,
            email: user.email,
        });

        logger.info(`New user registered: ${user.email}`);

        successResponse(
            res,
            "User registered successfully",
            { user, accessToken, refreshToken },
            201
        );
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/auth/login
 */
export async function login(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { email, password } = req.body as {
            email: string;
            password: string;
        };

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new UnauthorizedError("Invalid email or password");
        }

        // Compare password
        const isPasswordValid = await comparePassword(password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedError("Invalid email or password");
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = generateRefreshToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        logger.info(`User logged in: ${user.email}`);

        successResponse(res, "Login successful", {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/auth/refresh-token
 */
export async function refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { refreshToken: token } = req.body as {
            refreshToken: string;
        };

        if (!token) {
            throw new UnauthorizedError("Refresh token is required");
        }

        const decoded = verifyRefreshToken(token);

        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            throw new UnauthorizedError("User no longer exists");
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const newRefreshToken = generateRefreshToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        successResponse(res, "Token refreshed successfully", {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/auth/logout
 */
export async function logout(
    _req: Request,
    res: Response,
    _next: NextFunction
): Promise<void> {
    // With JWT, logout is handled client-side by removing the token.
    // This endpoint exists for API consistency and can be extended
    // with token blacklisting if needed.
    successResponse(res, "Logged out successfully");
}

/**
 * GET /api/auth/me
 */
export async function getMe(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.user) {
            throw new UnauthorizedError("Authentication required");
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        successResponse(res, "User fetched successfully", { user });
    } catch (error) {
        next(error);
    }
}
